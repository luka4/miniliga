#!/usr/bin/env node
// Scrapes autrin.sk (Miniliga) and FILLS GAPS in one season of docs/data/matches.json: a team match is only
// written when matches.json has no real rows for it yet (missing, or only WO/WO placeholder rows).
// Existing rows with real data are never modified; placeholders follow autrin's date/time/place.
// Usage: node crawl.mjs [--out docs/data/matches.json] [--rocnik 4] [--season "JESEŇ 2026"] [--notify-out played.json]
// Writes nothing (exit 1) when a safety check fails, so a failed run keeps the last good data.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { parseRoundIds, parseRound, parseProtocol } from './parse.mjs';
import { loadRoster, makeResolver, location } from './names.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('out', 'docs/data/matches.json');
const NOTIFY_OUT = arg('notify-out', ''); // optional: JSON list of newly played team matches, read by notify.mjs
const ROCNIK =arg('rocnik', '4');
const SEASON = arg('season', 'JESEŇ 2026');
const SHEET_ID = '1lFPZ5yyC6Zt1_d8MxOriGBH4v9G07bXetwjCtWGcPUw'; // same spreadsheet as googleSheetsLoader.js
const BASE = `http://www.autrin.sk/miniligake_app.php?sport_id=1&sutaz_id=1&rocnik_id=${ROCNIK}&druzstvo_id=0`;
const EXPECTED_TEAMS = 16, EXPECTED_ROUNDS = 15;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  await sleep(300);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
// Python json.dumps style (", " / ": "), as the file is currently written
const dump = (rows) => '[' + rows.map((r) => '{' + Object.entries(r).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ') + '}').join(', ') + ']';

async function main() {
  const raw = readFileSync(OUT, 'utf8');
  const all = JSON.parse(raw);
  if (dump(all) !== raw) console.warn('WARN: file formatting differs from the serializer; the diff will include whitespace changes');
  const old = all.filter((m) => m.season === SEASON);
  const rest = all.filter((m) => m.season !== SEASON);

  const roster = await loadRoster(SHEET_ID, SEASON);
  const existingNames = all.flatMap((m) => [m.player_a, m.player_b].flatMap((p) => p.split('/'))).filter((n) => n !== 'WO');
  const res = makeResolver({ roster, existingNames });

  const roundIds = parseRoundIds(await get(`${BASE}&kola_zobr=1`));
  if (roundIds.length !== EXPECTED_ROUNDS) throw new Error(`Expected ${EXPECTED_ROUNDS} rounds, found ${roundIds.length}`);

  const mkey = (r) => `${r.round}|${r.player_a_team}|${r.player_b_team}`;
  const existing = new Map(); // match key -> has real (non-placeholder) rows
  for (const r of old) existing.set(mkey(r), existing.get(mkey(r)) || r.player_a !== 'WO' || r.player_b !== 'WO');
  const fills = new Map(); // match key -> rows replacing the placeholder / filling the gap
  const filled = [];
  const played = []; // team matches that got real results in this run (for notifications)
  const teamsSeen = new Set();
  for (const [i, id] of roundIds.entries()) {
    const round = `${i + 1} kolo`;
    for (const tm of parseRound(await get(`${BASE}&kola_zobr=1&zobr_kolo_id=${id}`))) {
      const [ta, tb] = [res.team(tm.home), res.team(tm.away)];
      teamsSeen.add(ta); teamsSeen.add(tb);
      const mk = (a, b, sa, sb, doubles) => ({
        score_a: sa, score_b: sb, player_a: a, player_b: b, round, player_a_team: ta, player_b_team: tb,
        ...(doubles ? { doubles: true } : {}), date: tm.date, location: location(tm.location), season: SEASON, group: '',
      });
      const key = `${round}|${ta}|${tb}`;
      if (existing.get(key)) continue; // already filled: leave untouched
      const rows = [];
      const games = tm.score && tm.id ? parseProtocol(await get(`${BASE}&zapis_zobr=1&zapas_zobr_id=${tm.id}`)) : [];
      if (!games.length) { // not played yet, or played without a protocol: one placeholder row
        // placeholder (or gap): rewritten every run so schedule changes (date/time/place) are picked up
        const prev = old.find((r) => mkey(r) === key);
        if (prev && (prev.date !== tm.date || prev.location !== location(tm.location))) filled.push(`${round} ${tm.home} - ${tm.away}: rescheduled ${prev.date} -> ${tm.date}`);
        rows.push(mk('WO', 'WO', tm.score?.[0] ?? 0, tm.score?.[1] ?? 0, false));
        fills.set(key, rows);
        continue;
      }
      let wa = 0, wb = 0;
      for (const g of games) {
        const [a, b] = [g.a.map(res.player).join('/'), g.b.map(res.player).join('/')];
        rows.push(mk(a, b, g.sets[0], g.sets[1], g.doubles));
        if (g.sets[0] > g.sets[1]) wa++; else if (g.sets[1] > g.sets[0]) wb++;
      }
      fills.set(key, rows);
      filled.push(`${round} ${tm.home} - ${tm.away}`);
      played.push({ round, home: ta, away: tb, score_a: tm.score[0], score_b: tm.score[1] });
      if (wa !== tm.score[0] || wb !== tm.score[1]) {
        throw new Error(`Round ${i + 1} ${tm.home}-${tm.away}: protocol wins ${wa}:${wb} != team score ${tm.score.join(':')}`);
      }
    }
  }
  if (teamsSeen.size !== EXPECTED_TEAMS) throw new Error(`Expected ${EXPECTED_TEAMS} teams, found ${teamsSeen.size}`);

  // Merge in place: a fill replaces the match's existing placeholder rows at their position;
  // matches not in the file yet go after the last row of their round.
  const merged = [];
  for (const r of old) {
    const k = mkey(r);
    if (!fills.has(k)) { merged.push(r); continue; }
    if (fills.get(k)) { merged.push(...fills.get(k)); fills.set(k, null); } // first placeholder row emits the fill
  }
  for (const [k, rows] of fills) {
    if (!rows) continue;
    let at = merged.map((r) => r.round).lastIndexOf(rows[0].round);
    merged.splice(at < 0 ? merged.length : at + 1, 0, ...rows);
  }
  const all2 = [...rest, ...merged];
  writeFileSync(OUT, dump(all2));
  if (NOTIFY_OUT) writeFileSync(NOTIFY_OUT, JSON.stringify(played));
  const summary = [`${SEASON}: ${old.length} -> ${merged.length} rows`, ...filled.map((f) => `  filled: ${f}`)];
  if (res.fresh.size) {
    summary.push('NEW names (not in roster/matches.json; add overrides to scripts/autrin/name-map.json if wrong):',
      ...[...res.fresh].map(([a, g]) => `  ${a} -> ${g}`));
  }
  console.log(summary.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + summary.join('\n') + '\n```\n');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
