import { track } from '../systems/Analytics';
import { getHandle } from '../systems/Leaderboard';

/**
 * Share-your-drive. Primary path is an SMS compose (mobile): a challenge text
 * with a ?ref=<handle> link, so a friend's play/claim credits the referrer for
 * the "+5% off when a friend plays" bonus (refBy flows through the claim into
 * Klaviyo as bccc_referred_by). Desktop copies the same text to the clipboard.
 * renderCard() (the 1080×1080 brand image) is kept for a future image-post path.
 */
const CW = 1080;
const CH = 1080;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

export async function renderCard(bestDrive: number): Promise<Blob | null> {
  const base = import.meta.env.BASE_URL;
  const [crest, lockup] = await Promise.all([
    loadImg(`${base}assets/art/crest.png`),
    loadImg(`${base}assets/art/bccc-lockup.png`),
  ]);

  const cv = document.createElement('canvas');
  cv.width = CW;
  cv.height = CH;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  // pine radial field
  const g = ctx.createRadialGradient(CW / 2, CH * 0.38, 80, CW / 2, CH / 2, CW * 0.78);
  g.addColorStop(0, '#20392a');
  g.addColorStop(1, '#14261b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);

  // engraved double border
  ctx.strokeStyle = 'rgba(236,227,207,.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40.5, 40.5, CW - 81, CH - 81);
  ctx.strokeStyle = 'rgba(184,152,90,.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(56.5, 56.5, CW - 113, CH - 113);

  // crest + lockup (brand assets are cream — correct on pine)
  if (crest) {
    const h = 225;
    const w = h * (crest.width / crest.height);
    ctx.drawImage(crest, (CW - w) / 2, 108, w, h);
  }
  if (lockup) {
    const w = 520;
    const h = w * (lockup.height / lockup.width);
    ctx.drawImage(lockup, (CW - w) / 2, 386, w, h);
  }

  const center = CW / 2;
  const serif = '"Cormorant Garamond", Georgia, serif';
  const tracked = (px: string): void => {
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = px;
    } catch {
      /* older engines — fine untracked */
    }
  };

  // BEST DRIVE label
  ctx.textAlign = 'center';
  ctx.fillStyle = '#93a384';
  tracked('12px');
  ctx.font = `600 34px ${serif}`;
  ctx.fillText('BEST DRIVE', center + 6, 672);
  tracked('0px');

  // the number + YD
  const num = String(bestDrive);
  ctx.font = `700 188px ${serif}`;
  const nw = ctx.measureText(num).width;
  ctx.font = `600 62px ${serif}`;
  const yw = ctx.measureText('YD').width;
  const gap = 22;
  const left = center - (nw + gap + yw) / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ece3cf';
  ctx.font = `700 188px ${serif}`;
  ctx.fillText(num, left, 832);
  ctx.fillStyle = '#93a384';
  ctx.font = `600 62px ${serif}`;
  ctx.fillText('YD', left + nw + gap, 832);

  // tagline + footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfc6ad';
  ctx.font = `italic 40px ${serif}`;
  ctx.fillText('No suits. No ties. Only good times.', center, 916);
  ctx.fillStyle = '#6f7e62';
  tracked('10px');
  ctx.font = `600 28px ${serif}`;
  ctx.fillText('THE DRIVING RANGE', center + 5, 984);
  tracked('0px');

  return await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
}

/** The challenge text + referral link a player sends to a friend. */
function challengeText(bestDrive: number): string {
  // the drop page should set VITE_BCCC_SHARE_URL so links point at the real page
  const envUrl = import.meta.env.VITE_BCCC_SHARE_URL as string | undefined;
  const base = envUrl ?? location.origin + location.pathname;
  const url = `${base}${base.includes('?') ? '&' : '?'}ref=${encodeURIComponent(getHandle())}`;
  return (
    `I just drove ${bestDrive} yards at the Blue Collar Country Club Driving Range. ` +
    `Beat me and we BOTH get an extra 5% off the drop: ${url}`
  );
}

/**
 * Share the drive: mobile opens the SMS composer prefilled with the challenge
 * text + referral link; desktop copies the same text to the clipboard. Returns
 * how it was handled so the button can give feedback.
 */
export async function shareDrive(bestDrive: number): Promise<'sms' | 'copied' | 'noop'> {
  const text = challengeText(bestDrive);
  if (navigator.maxTouchPoints > 0) {
    // sms:?&body= is the form both iOS and Android accept
    track('bccc_shared', { bestDrive, method: 'sms' });
    location.href = `sms:?&body=${encodeURIComponent(text)}`;
    return 'sms';
  }
  try {
    await navigator.clipboard.writeText(text);
    track('bccc_shared', { bestDrive, method: 'copy' });
    return 'copied';
  } catch {
    // async clipboard refused (permissions/iframe) — legacy path
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) {
        track('bccc_shared', { bestDrive, method: 'copy' });
        return 'copied';
      }
    } catch {
      /* fall through */
    }
    return 'noop';
  }
}
