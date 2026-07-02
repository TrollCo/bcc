/**
 * BCCC brand palette. Hex strings mirror the prototype's CSS custom properties;
 * the 0x numbers are the same colors for PixiJS fills/strokes.
 *
 * The duotone grade (render/filters/GradeFilter) re-maps scene luminance onto the
 * pine -> sage -> bone ramp, so scene source colors only need correct *relative
 * luminance*. These values are the prototype's, kept so the graded output matches.
 */

export const PALETTE = {
  pine: '#23402f',
  pineDeep: '#182d20',
  pineLine: '#2f5440',
  bone: '#ece3cf',
  boneDim: '#cfc6ad',
  sage: '#93a384',
  sageDeep: '#6f7e62',
  ink: '#14160f',
  gold: '#b8985a',
  goldBright: '#d8b878',
} as const;

/** Numeric (0x) versions for Pixi. */
export const HEX = {
  pine: 0x23402f,
  pineDeep: 0x182d20,
  pineLine: 0x2f5440,
  bone: 0xece3cf,
  boneDim: 0xcfc6ad,
  sage: 0x93a384,
  sageDeep: 0x6f7e62,
  ink: 0x14160f,
  gold: 0xb8985a,
  goldBright: 0xd8b878,
} as const;

/**
 * The three duotone ramp anchors used by the grade shader, as 0..1 vec3s.
 * Pine (shadows) -> Sage (mids) -> Bone (highlights). Ported from the FRAG
 * constants in the prototype.
 */
export const RAMP = {
  pine: [0.106, 0.22, 0.157] as [number, number, number],
  pine2: [0.137, 0.251, 0.184] as [number, number, number],
  sage: [0.576, 0.64, 0.518] as [number, number, number],
  bone: [0.925, 0.89, 0.812] as [number, number, number],
  boneHi: [0.98, 0.95, 0.86] as [number, number, number],
} as const;

/** Scene source colors (pre-grade), ported from the prototype's 2D draw calls. */
export const SCENE = {
  skyTop: 0xefe7d4,
  skyBottom: 0xe3dcc4,
  fairwayTop: 0x2c5038,
  fairwayBottom: 0x1f3a2a,
  // golfer
  shirt: 0x7d8c6c,
  shirtD: 0x566249,
  shirtL: 0x8fa07c,
  pants: 0x6c795b,
  pantsD: 0x4c5640,
  skin: 0xbdb892,
  hat: 0x9aa884,
  hatD: 0x6f8064,
  // range / props
  ball: 0xfbf7ec,
  tee: 0xcdbf9c,
  meterTrack: 0x1b3124,
} as const;
