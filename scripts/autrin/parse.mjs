// HTML parsing for autrin.sk miniliga pages (plain regexes; the markup is simple and stable).

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&nbsp;': ' ' };
export const decode = (s) => s.replace(/&(amp|lt|gt|quot|nbsp|#039);/g, (m) => ENTITIES[m]);
const text = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Round ids (zobr_kolo_id) in the order they appear on the rounds index.
export function parseRoundIds(html) {
  const ids = [...html.matchAll(/kola_zobr=1&zobr_kolo_id=(\d+)'/g)].map((m) => Number(m[1]));
  return [...new Set(ids)].filter((id) => id > 0);
}

// Team matches of one round page. score is null when not played yet ("- : -").
export function parseRound(html) {
  const matches = [];
  for (const [, row] of html.matchAll(/<tr style='background-color: #e0f0ff'>(.*?)<\/tr>/gs)) {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const [home, away] = [text(cells[1]), text(cells[3])];
    const sc = text(cells[2]).match(/^(\d+)\s*:\s*(\d+)$/);
    // "2026-09-07 --Rampová 7, Pondelok, 17:30"
    const where = text(cells[4]).match(/^(\d{4}-\d{2}-\d{2}) --(.*?),\s*[^,]+,\s*(\d{1,2}:\d{2})/);
    if (!where) throw new Error(`Unparseable date/place cell: ${text(cells[4])}`);
    const id = row.match(/zapas_zobr_id=(\d+)/)?.[1];
    matches.push({
      id: id ? Number(id) : null,
      home,
      away,
      score: sc ? [Number(sc[1]), Number(sc[2])] : null,
      date: `${where[1]} ${where[3].padStart(5, '0')}`,
      location: where[2].trim(),
    });
  }
  return matches;
}

// Individual matches of one protocol page, in protocol order.
export function parseProtocol(html) {
  const part = html.slice(html.indexOf('Zápasové súboje'));
  const games = [];
  for (const [, row] of part.matchAll(/<tr style='background-color: #(?!999)[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const players = (c) => c.split(/<br\s*\/?>/i).map((p) => text(p).replace(/^[A-Za-z0-9]+\s*:\s*/, '')).filter(Boolean);
    const sets = text(cells[4]).match(/^(\d+)\s*:\s*(\d+)$/);
    if (!sets) continue;
    games.push({
      doubles: /štvorhra/i.test(text(cells[1])),
      a: players(cells[2]),
      b: players(cells[3]),
      sets: [Number(sets[1]), Number(sets[2])],
    });
  }
  return games;
}
