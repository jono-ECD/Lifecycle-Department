// Reads what was pasted into the Klaviyo key field. Pure, no server imports.
// Copying from Klaviyo or from a chat often brings quotes, spaces, line breaks or a label along,
// and browsers sometimes fill the field by themselves. Klaviyo is the judge of whether a key works;
// this only tidies the paste and explains what is wrong without ever repeating the key.

export type KlaviyoKeyResult = { key: string; problem?: undefined } | { key?: undefined; problem: string };

// spaces, line breaks, zero width characters and the byte order mark
const INVISIBLE = /[\s​-‍⁠﻿ ]/g;
const WHERE = 'Find it in Klaviyo under Settings, API keys.';

export function readKlaviyoKey(raw: string): KlaviyoKeyResult {
  let s = raw.replace(INVISIBLE, '');
  // a label or header copied along with the key
  s = s.replace(/^(authorization:?)?(klaviyo-api-key|bearer)[:=]?/i, '').replace(/^[A-Za-z_]*KEY[:=]/i, '');
  // quotes or brackets around it
  s = s.replace(/^["'`<([{]+/, '').replace(/["'`>)\]},;.]+$/, '');
  if (/^pk_[A-Za-z0-9_-]{10,}$/i.test(s)) return { key: `pk_${s.slice(3)}` };

  if (!s) return { problem: `The key field is empty. ${WHERE}` };
  if (/^pk_/i.test(s)) {
    if (s.length < 13) return { problem: `That key looks cut short, it has ${s.length} characters. Copy the whole key and paste it again.` };
    return { problem: 'That key has characters a Klaviyo key never has. Clear the field and paste only the key.' };
  }
  if (/pk_[A-Za-z0-9]{10,}/i.test(s)) return { problem: 'There is other text in front of the key. Clear the field completely, then paste only the key. If your browser fills this field by itself, delete what it put there first.' };
  if (/^[A-Za-z0-9]{6,7}$/.test(s)) return { problem: `That is the public key, also called the site ID. The private key is the long one that starts with pk_. ${WHERE}` };
  return { problem: `What is in the key field has ${s.length} characters and does not start with pk_. Clear the field completely and paste the private key again. ${WHERE}` };
}
