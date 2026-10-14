// Name/team resolution: keep OUR spellings (roster sheet first, then names already in matches.json).
import { readFileSync } from 'node:fs';

const TITLES = /\b(ing|mgr|dr|phdr|rndr|doc|prof|judr|mudr|bc|bca)\b\.?/gi;
export const normName = (s) =>
  [...new Set(
    s.replace(TITLES, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean),
  )].sort().join(' ');
const normTeam = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const config = JSON.parse(readFileSync(new URL('./name-map.json', import.meta.url), 'utf8'));

export const location = (l) => config.locations[l] ?? l;

// gviz CSV: quoted fields, "" escapes
function parseCsv(csv) {
  const rows = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    rows.push([...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map((m) => (m[1] ?? m[2]).replace(/""/g, '"')));
  }
  return rows;
}

export async function loadRoster(sheetId, season) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('DB_' + season)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Roster fetch failed: HTTP ${res.status}`);
  return parseCsv(await res.text()).filter((r) => r[0] && r[1]).map((r) => ({ name: r[0].trim(), team: r[1].trim() }));
}

export function makeResolver({ roster, existingNames }) {
  const index = new Map(); // normName -> our spelling. Roster wins over older matches.json spellings.
  const add = (n, override) => { const k = normName(n); if (k && (override || !index.has(k))) index.set(k, n); };
  roster.forEach((r) => add(r.name, true));
  existingNames.forEach((n) => add(n, false));
  const teams = new Map(roster.map((r) => [normTeam(r.team), r.team]));
  const fresh = new Map(); // autrin name -> guessed name, for the review report

  return {
    fresh,
    team(autrinTeam) {
      const t = config.teams[autrinTeam] ?? teams.get(normTeam(autrinTeam));
      if (!t) throw new Error(`Unknown team "${autrinTeam}" - add it to name-map.json "teams"`);
      return t;
    },
    player(autrinName) {
      const o = config.players[autrinName];
      if (o) return o;
      const hit = index.get(normName(autrinName));
      if (hit) return hit;
      // New player: "First LAST" (titles dropped, last token = surname)
      const toks = autrinName.replace(TITLES, ' ').split(/\s+/).filter(Boolean);
      const guess = toks.length > 1 ? `${toks.slice(0, -1).join(' ')} ${toks.at(-1).toLocaleUpperCase('sk')}` : toks[0];
      fresh.set(autrinName, guess);
      return guess;
    },
  };
}
