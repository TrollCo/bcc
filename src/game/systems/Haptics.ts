/**
 * Tactile feedback for the swing loop. Two paths:
 *  - Android Chrome: navigator.vibrate with real durations/patterns.
 *  - iOS (Safari/Chrome — all WebKit): Apple blocks navigator.vibrate, but
 *    toggling a hidden <input type="checkbox" switch> fires the system haptic
 *    tick (iOS 17.4+). No duration control — patterns become 1-3 spaced ticks.
 * Haptics fire regardless of the Sound toggle — touch feedback, not audio.
 */
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
const isTouchWebKit =
  !canVibrate && typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

let iosLabel: HTMLLabelElement | null = null;

/** One system haptic tick on iOS via the checkbox-switch trick. Activating a
 *  LABEL that wraps the switch is the variant WebKit honors most reliably; the
 *  control must be interactive (no pointer-events:none / display:none) but can
 *  sit offscreen at opacity 0. */
function iosTick(): void {
  if (!iosLabel) {
    iosLabel = document.createElement('label');
    iosLabel.setAttribute('aria-hidden', 'true');
    iosLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;';
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.setAttribute('switch', '');
    sw.tabIndex = -1;
    iosLabel.appendChild(sw);
    document.body.appendChild(iosLabel);
  }
  iosLabel.click();
}

function buzz(pattern: number | number[]): void {
  try {
    if (canVibrate) {
      navigator.vibrate(pattern);
      return;
    }
    if (!isTouchWebKit) return;
    // approximate the pattern: one tick per vibration segment, max 3, spaced out
    const segs = Array.isArray(pattern) ? Math.min(Math.ceil(pattern.length / 2) + 1, 3) : 1;
    iosTick();
    for (let i = 1; i < segs; i++) setTimeout(iosTick, i * 90);
  } catch {
    /* no haptics — fine */
  }
}

export const Haptics = {
  /** Meter lock (power / contact taps) — a crisp tick. */
  tap(): void {
    buzz(8);
  },
  /** Club-on-ball impact, scaled by swing power. */
  impact(power: number): void {
    buzz(Math.round(14 + 22 * power));
  },
  /** First bounce on the fairway. */
  land(): void {
    buzz(10);
  },
  /** Sub-par shot grade. */
  thud(): void {
    buzz([12, 40, 8]);
  },
  /** Membership / PURE strike — a little drumroll. */
  celebrate(): void {
    buzz([24, 60, 24, 60, 48]);
  },
};
