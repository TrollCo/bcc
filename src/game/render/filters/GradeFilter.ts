import { Filter, GlProgram } from 'pixi.js';
import { W, H } from '../../constants';

/**
 * GradeFilter — the BCCC engraved grade, ported VERBATIM from the prototype's
 * fragment shader (reference/bccc-driving-range.html, the FRAG block) and wrapped
 * as a single PixiJS v8 full-stage filter. It stacks, in one pass:
 *
 *   1. Duotone / palette-lock   — luminance -> pine -> sage -> bone ramp
 *   2. 45deg crosshatch etch    — two line screens modulated by luminance
 *   3. Halation bloom           — highlights bleed into a bone glow
 *   4. Film grain + paper fiber — animated noise + static fiber
 *   5. Vignette                 — edge falloff
 *
 * This is the move that color-matches the game to the drop-stitcher video grade,
 * and forces every input on-palette regardless of source art. Every intensity is
 * exposed via GradeOptions so it can be tuned to drop-stitcher in Phase 2.
 */
export interface GradeOptions {
  chroma: number; // how much original color survives the duotone (0..1)
  halftone: number; // crosshatch etch strength multiplier
  halation: number; // highlight bloom strength
  grain: number; // film grain amplitude
  fiber: number; // paper fiber amplitude
  vignette: number; // edge floor (lower = darker corners)
}

/** Defaults are the prototype's exact values. */
export const DEFAULT_GRADE: GradeOptions = {
  chroma: 0.22,
  halftone: 1.0,
  halation: 1.2,
  grain: 0.045,
  fiber: 0.05,
  vignette: 0.74,
};

// Standard PixiJS v8 filter vertex. uInputSize / uOutputFrame / uOutputTexture
// are injected by the FilterSystem; Pixi prepends #version + precision.
const vertex = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;

uniform float uTime;
uniform vec2  uRes;
uniform float uChroma;
uniform float uHalftone;
uniform float uHalation;
uniform float uGrain;
uniform float uFiber;
uniform float uVignette;

const vec3 PINE   = vec3(0.106, 0.220, 0.157);
const vec3 PINE2  = vec3(0.137, 0.251, 0.184);
const vec3 SAGE   = vec3(0.576, 0.640, 0.518);
const vec3 BONE   = vec3(0.925, 0.890, 0.812);
const vec3 BONEHI = vec3(0.98, 0.95, 0.86);

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main(void){
  vec2 uv = vTextureCoord;
  vec3 src = texture(uTexture, uv).rgb;
  float l = luma(src);

  // 1. duotone / palette lock
  vec3 duo;
  if (l < 0.33)      duo = mix(PINE,  PINE2, l / 0.33);
  else if (l < 0.62) duo = mix(PINE2, SAGE,  (l - 0.33) / 0.29);
  else               duo = mix(SAGE,  BONE,  (l - 0.62) / 0.38);
  duo = mix(duo, src, uChroma); // keep a touch of brand chroma

  // 2. 45deg crosshatch etch (two line screens)
  vec2 sp = uv * uRes;
  float c1 = cos(0.785398); float s1 = sin(0.785398);
  float scr1 = 0.5 + 0.5 * sin((sp.x * c1 - sp.y * s1) * 1.4);
  duo *= 1.0 - smoothstep(0.0, 0.5, 1.0 - l) * (1.0 - scr1) * 0.20 * uHalftone;
  float scr2 = 0.5 + 0.5 * sin((sp.x * c1 + sp.y * s1) * 1.4);
  duo *= 1.0 - smoothstep(0.0, 0.35, 1.0 - l) * (1.0 - scr2) * 0.14 * uHalftone;

  // 3. halation bloom
  vec3 glow = vec3(0.0);
  float texel = 1.0 / uRes.y;
  for (int i = 0; i < 12; i++) {
    float a = float(i) / 12.0 * 6.2831853;
    vec2 off = vec2(cos(a), sin(a)) * texel * 6.0;
    vec3 ss = texture(uTexture, uv + off).rgb;
    glow += max(0.0, luma(ss) - 0.72) * ss;
  }
  glow /= 12.0;
  duo += glow * BONEHI * uHalation;

  // 4. film grain + paper fiber
  float g = vnoise(uv * uRes * 0.9 + uTime * 60.0);
  duo += (g - 0.5) * uGrain;
  float fib = vnoise(uv * vec2(uRes.x * 0.25, uRes.y * 0.25));
  duo *= (1.0 - uFiber * 0.6) + fib * uFiber;

  // 5. vignette
  vec2 vd = uv - 0.5;
  float vig = smoothstep(0.9, 0.35, length(vd) * 1.25);
  duo *= mix(uVignette, 1.0, vig);

  finalColor = vec4(clamp(duo, 0.0, 1.0), 1.0);
}
`;

export class GradeFilter extends Filter {
  constructor(opts: Partial<GradeOptions> = {}) {
    const o = { ...DEFAULT_GRADE, ...opts };
    super({
      glProgram: GlProgram.from({ vertex, fragment }),
      resources: {
        gradeUniforms: {
          uTime: { value: 0, type: 'f32' },
          uRes: { value: new Float32Array([W, H]), type: 'vec2<f32>' },
          uChroma: { value: o.chroma, type: 'f32' },
          uHalftone: { value: o.halftone, type: 'f32' },
          uHalation: { value: o.halation, type: 'f32' },
          uGrain: { value: o.grain, type: 'f32' },
          uFiber: { value: o.fiber, type: 'f32' },
          uVignette: { value: o.vignette, type: 'f32' },
        },
      },
    });
  }

  private get u(): Record<string, number | Float32Array> {
    return (this.resources.gradeUniforms as { uniforms: Record<string, number | Float32Array> }).uniforms;
  }

  /** Advance the animated film grain. */
  setTime(t: number): void {
    this.u.uTime = t;
  }

  /** Live-update any subset of intensities (handy for a tuning panel). */
  setOptions(opts: Partial<GradeOptions>): void {
    if (opts.chroma !== undefined) this.u.uChroma = opts.chroma;
    if (opts.halftone !== undefined) this.u.uHalftone = opts.halftone;
    if (opts.halation !== undefined) this.u.uHalation = opts.halation;
    if (opts.grain !== undefined) this.u.uGrain = opts.grain;
    if (opts.fiber !== undefined) this.u.uFiber = opts.fiber;
    if (opts.vignette !== undefined) this.u.uVignette = opts.vignette;
  }
}
