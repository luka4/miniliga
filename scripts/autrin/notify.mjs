#!/usr/bin/env node
// Sends a OneSignal push to all subscribers for each team match listed in the file written by
// `crawl.mjs --notify-out`. Needs env ONESIGNAL_APP_ID and ONESIGNAL_API_KEY (GitHub Actions secrets).
// Usage: node notify.mjs played.json
import { readFileSync } from 'node:fs';

const { ONESIGNAL_APP_ID, ONESIGNAL_API_KEY } = process.env;
if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) { console.error('Missing ONESIGNAL_APP_ID / ONESIGNAL_API_KEY'); process.exit(1); }

const played = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (!played.length) { console.log('No newly played matches, nothing to send.'); process.exit(0); }

async function send(title, body) {
  const res = await fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: { Authorization: `Key ${ONESIGNAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Total Subscriptions'],
      headings: { en: title },
      contents: { en: body },
      url: 'https://miniliga.sk/results.html',
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OneSignal HTTP ${res.status}: ${await res.text()}`);
  console.log(`Sent: ${title} | ${body}`);
}

// A big backlog (e.g. the first run after a long pause) becomes one summary instead of a burst of pushes.
const MAX_SEPARATE = 4;
const line = (m) => `${m.home} vs ${m.away}: ${m.score_a}-${m.score_b}`;
if (played.length <= MAX_SEPARATE) {
  for (const m of played) await send('Zápas bol ukončený.', line(m));
} else {
  await send(`Ukončené zápasy (${played.length})`, played.map(line).join('\n'));
}
