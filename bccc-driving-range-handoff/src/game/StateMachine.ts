/**
 * The game's state machine — identical states and single-tap loop to the
 * prototype: TITLE -> ADDRESS -> POWER -> CONTACT -> SWING -> FLIGHT -> RESULT
 * -> SUMMARY. The transition logic (`tap`) and round flow live in GameLogic.ts;
 * this module just defines the states.
 */
export enum STATE {
  TITLE = 0,
  ADDRESS = 1,
  POWER = 2,
  CONTACT = 3,
  SWING = 4,
  FLIGHT = 5,
  RESULT = 6,
  SUMMARY = 7,
}

export const STATE_NAMES: Record<STATE, string> = {
  [STATE.TITLE]: 'TITLE',
  [STATE.ADDRESS]: 'ADDRESS',
  [STATE.POWER]: 'POWER',
  [STATE.CONTACT]: 'CONTACT',
  [STATE.SWING]: 'SWING',
  [STATE.FLIGHT]: 'FLIGHT',
  [STATE.RESULT]: 'RESULT',
  [STATE.SUMMARY]: 'SUMMARY',
};
