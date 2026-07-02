import type { Config } from './config';

/**
 * Upsert a profile and subscribe it to the "BCCC Members" list (which triggers
 * the welcome / early-access flow). Best-effort: a Klaviyo hiccup is logged but
 * never blocks the player from getting their code (the email is still captured in
 * the code mapping). Uses the JSON:API endpoints (revision-pinned).
 */
export async function upsertAndSubscribe(
  cfg: Config,
  email: string,
  props: { bestDrive: number; member: boolean; refBy?: string },
): Promise<void> {
  if (cfg.mock || !cfg.klaviyo.apiKey) return; // dev/mock: no external call
  const { apiKey, listId, revision } = cfg.klaviyo;
  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  const attributes = {
    email,
    properties: {
      bccc_best_drive: props.bestDrive,
      bccc_member: props.member,
      // referrer's anonymous handle (from the shared ?ref= link) — drive the
      // "+5% when a friend plays" bonus flow off this property in Klaviyo
      ...(props.refBy ? { bccc_referred_by: props.refBy } : {}),
      source: 'bccc-driving-range',
    },
  };

  try {
    // 1) create profile; on 409 (exists) grab the id and PATCH it
    let profileId: string | undefined;
    const create = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: { type: 'profile', attributes } }),
    });
    if (create.status === 201) {
      profileId = (await create.json())?.data?.id;
    } else if (create.status === 409) {
      profileId = (await create.json())?.errors?.[0]?.meta?.duplicate_profile_id;
      if (profileId) {
        await fetch(`https://a.klaviyo.com/api/profiles/${profileId}/`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ data: { type: 'profile', id: profileId, attributes } }),
        });
      }
    }

    // 2) add to the BCCC Members list
    if (profileId && listId) {
      await fetch(`https://a.klaviyo.com/api/lists/${listId}/relationships/profiles/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
      });
    }
  } catch (e) {
    console.warn('[bccc] klaviyo upsert failed (non-blocking):', (e as Error).message);
  }
}
