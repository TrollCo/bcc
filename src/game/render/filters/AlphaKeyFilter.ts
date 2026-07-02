import { Filter, GlProgram } from 'pixi.js';

/**
 * AlphaKeyFilter — turns a solid dark background to transparency by mapping
 * luminance to alpha. The brand art (sage line/shading on near-black) becomes a
 * clean cut-out with anti-aliased edges, with no external tooling. Tune uLo/uHi
 * to the art's black point vs. its darkest *figure* tone.
 *
 * Output is premultiplied (Pixi filter convention).
 */
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
vec2 filterTextureCoord( void ) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;

const fragment = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uLo;
uniform float uHi;
uniform float uInvert;
uniform float uGain;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
void main(void){
  vec4 c = texture(uTexture, vTextureCoord);
  float k = smoothstep(uLo, uHi, luma(c.rgb));
  // uInvert=0: keep highlights (drop dark field). uInvert=1: keep darks (drop light paper).
  float a = mix(k, 1.0 - k, uInvert) * c.a;
  // uGain darkens/brightens the kept pixels (applied after keying so the paper
  // removal is unaffected) — used to push the figure darker for contrast.
  finalColor = vec4(c.rgb * uGain * a, a); // premultiplied
}
`;

export class AlphaKeyFilter extends Filter {
  constructor(lo = 0.05, hi = 0.16, invert = false, gain = 1) {
    super({
      glProgram: GlProgram.from({ vertex, fragment }),
      resources: {
        keyUniforms: {
          uLo: { value: lo, type: 'f32' },
          uHi: { value: hi, type: 'f32' },
          uInvert: { value: invert ? 1 : 0, type: 'f32' },
          uGain: { value: gain, type: 'f32' },
        },
      },
    });
  }
}
