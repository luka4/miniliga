/*
 * Rating explainer: a slow, self-playing animation shown above the text in the
 * "Ako funguje rating?" modal (rating.html).
 *
 * Every visual is a pure function of the clock: seek(t) sets all styles from
 * t alone, so the player can pause, scrub, skip scenes and loop without any
 * state carried between frames. All numbers come from the same formula the
 * rating engine uses in script.js (divisor 300, K_FACTOR_STAGES), so they
 * cannot drift from the real thing.
 *
 * The stage is a fixed 800x420 canvas of absolutely positioned elements that
 * is scaled to the modal width; the captions are real HTML under the stage so
 * they stay readable on phones.
 */
(function () {
    const W = 800;
    const H = 420;
    const DIVISOR = 300;
    const K_STAGES = [30, 26, 22, 18, 14, 10];
    const COLORS = {
        ink: '#2c3e63', ink2: '#405482', sky: '#7db8ff', draw: '#f3cf5f', loss: '#f4868f',
        white: '#ffffff', green: '#16a34a', red: '#dc2626', orange: '#f59e0b', grey: '#9ca3af'
    };

    // ---------- helpers ----------
    const clamp01 = (x) => Math.min(1, Math.max(0, x));
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
    const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const easeOutBounce = (x) => {
        const n = 7.5625, d = 2.75;
        if (x < 1 / d) return n * x * x;
        if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
        if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
        return n * (x -= 2.625 / d) * x + 0.984375;
    };
    const prog = (t, start, dur, ease = (x) => x) => ease(clamp01((t - start) / dur));
    const fmt = (n, d = 0) => n.toFixed(d).replace('.', ',');
    const signed = (n, d = 0) => (n < 0 ? '−' : '+') + Math.abs(n).toFixed(d).replace('.', ',');
    const expected = (ra, rb, n) => n / (1 + Math.pow(10, (rb - ra) / DIVISOR));

    function mk(parent, cls, html, css) {
        const e = document.createElement('div');
        e.className = cls;
        if (html) e.innerHTML = html;
        if (css) Object.assign(e.style, css);
        if (parent) parent.appendChild(e);
        return e;
    }
    // fade + rise in at local time `at`
    function appear(e, lt, at, dur = 0.6, dy = 14) {
        const p = prog(lt, at, dur, easeOutCubic);
        e.style.opacity = p;
        e.style.transform = `translateY(${(dy * (1 - p)).toFixed(2)}px)`;
    }
    function ball(parent, x, y, color, letter) {
        return mk(parent, 'ex-ball', letter, { left: (x - 36) + 'px', top: (y - 36) + 'px', background: color });
    }
    function title(root, text) {
        return mk(root, 'ex-title', text, { left: '36px', top: '22px' });
    }
    function center(root, cls, html, top, extra) {
        return mk(root, 'ex-c ' + cls, html, Object.assign({ top: top + 'px' }, extra || {}));
    }
    // a row of cells revealed one after another
    function row(root, top, cells, at, step) {
        const r = mk(root, 'ex-row', '', { top: top + 'px' });
        const els = cells.map((h) => mk(r, 'ex-cell', h));
        return (lt) => els.forEach((e, i) => appear(e, lt, at + i * step, 0.5, 10));
    }

    // ---------- scenes ----------
    const SCENES = [];

    // 0 - intro
    SCENES.push({
        caps: [[0.8, 'Pozri si, ako Minilíga počíta rating hráčov.'], [3.0, 'Animáciu môžeš kedykoľvek pozastaviť alebo prepnúť na ďalší krok.']],
        dur: 6.5,
        build(root) {
            mk(root, 'ex-table', '', { left: '210px', top: '196px', width: '380px' });
            mk(root, 'ex-net', '', { left: '398px', top: '168px' });
            const b = mk(root, 'ex-ball ex-ball--s', '', { left: '364px' });
            const t = center(root, 'ex-hero', 'AKO FUNGUJE<br>RATING?', 236);
            const s = center(root, 'ex-sub', 'Upravený ELO systém pre stolný tenis', 372);
            return (lt) => {
                const bounce = Math.abs(Math.sin(Math.PI * lt / 0.9));
                b.style.top = (160 - 90 * bounce) + 'px';
                b.style.opacity = prog(lt, 0, 0.4);
                appear(t, lt, 0.4, 0.8, 20);
                appear(s, lt, 2.2);
            };
        }
    });

    // 1 - start at 100
    SCENES.push({
        caps: [[1.2, 'Každý nový hráč začína s ratingom 100.'], [4.5, 'Samotné číslo nič nehovorí, dôležité je, ako sa mení po zápasoch.'], [8.0, 'Vyšší rating znamená silnejšieho hráča.']],
        dur: 11.5,
        build(root) {
            title(root, '1 · Štart na 100');
            const b = ball(root, 400, 0, COLORS.sky, 'N');
            const n = center(root, 'ex-big', '0', 226);
            const tag = center(root, 'ex-chip-wrap', '<span class="ex-chip">NOVÝ HRÁČ · ROZHODNÝ START</span>', 322);
            return (lt) => {
                const y = -60 + (178 + 60) * easeOutBounce(prog(lt, 0.8, 1.5));
                b.style.top = (y - 36) + 'px';
                b.style.opacity = prog(lt, 0.7, 0.2);
                n.textContent = String(Math.round(100 * prog(lt, 2.4, 1.8, easeOutCubic)));
                appear(n, lt, 2.2, 0.4, 0);
                appear(tag, lt, 4.0);
            };
        }
    });

    // 2 - compare two ratings
    SCENES.push({
        caps: [[1.0, 'Elo porovná ratingy oboch hráčov pred zápasom.'], [4.5, 'Silnejší hráč (130) by mal uhrať viac setov ako slabší (100).'], [8.0, 'Rozdiel 30 bodov je mierna výhoda, väčší rozdiel znamená väčšiu.']],
        dur: 11.5,
        build(root) {
            title(root, '2 · Elo porovnáva ratingy');
            const a = ball(root, 170, 190, COLORS.sky, 'A');
            const b = ball(root, 630, 190, COLORS.draw, 'B');
            const an = center(root, 'ex-num', '130', 240, { width: '200px', left: '70px' });
            const bn = center(root, 'ex-num', '100', 240, { width: '200px', left: '530px' });
            const line = mk(root, 'ex-line', '', { left: '236px', top: '188px', width: '328px' });
            const dl = center(root, 'ex-tiny', 'ROZDIEL RATINGU', 150);
            const dv = center(root, 'ex-big ex-big--s', '+30', 96);
            const fav = center(root, 'ex-chip-wrap', '<span class="ex-chip ex-chip--sky">mierny favorit</span>', 312, { width: '200px', left: '70px' });
            return (lt) => {
                appear(a, lt, 1.0); appear(an, lt, 1.4);
                appear(b, lt, 2.2); appear(bn, lt, 2.6);
                line.style.transform = `scaleX(${prog(lt, 4.2, 1.2, easeInOutCubic)})`;
                appear(dl, lt, 5.2); appear(dv, lt, 5.6);
                appear(fav, lt, 8.0);
            };
        }
    });

    // 3 - expected sets
    (function () {
        const ra = 130, rb = 100, n = 4, e = expected(ra, rb, n);
        SCENES.push({
            caps: [[1.0, 'Zápas má N setov, tu 4. Systém odhadne, koľko z nich uhrá A.'], [5.0, 'Deliteľ 300 určuje, ako silno rozdiel ratingov pôsobí.'], [9.0, `Výsledok: A čaká ${fmt(e, 2)} setu, B ${fmt(n - e, 2)}.`]],
            dur: 12.5,
            build(root) {
                title(root, '3 · Očakávané sety');
                const bar = mk(root, 'ex-bar', '', { left: '80px', top: '120px', width: '640px' });
                const sa = mk(bar, 'ex-seg ex-seg--a', '<b>A</b> ' + fmt(e, 2));
                const sb = mk(bar, 'ex-seg ex-seg--b', '<b>B</b> ' + fmt(n - e, 2));
                const ticks = [1, 2, 3].map((i) => mk(bar, 'ex-tick', '', { left: (i * 160) + 'px' }));
                const nl = center(root, 'ex-tiny', `ZÁPAS MÁ N = ${n} SETY`, 90);
                const f1 = center(root, 'ex-formula', 'E = N / (1 + 10<sup>(R<sub>B</sub> − R<sub>A</sub>) / 300</sup>)', 220, { left: '80px', width: '640px' });
                const f2 = center(root, 'ex-formula ex-formula--v', `E = ${n} / (1 + 10<sup>(${rb} − ${ra}) / 300</sup>) = <b>${fmt(e, 2)}</b>`, 300, { left: '80px', width: '640px' });
                return (lt) => {
                    appear(bar, lt, 1.0); appear(nl, lt, 1.2);
                    ticks.forEach((t) => { t.style.opacity = prog(lt, 1.6, 0.5); });
                    const g = prog(lt, 3.0, 1.6, easeInOutCubic);
                    sa.style.width = (g * e / n * 100) + '%';
                    sb.style.width = (g * (n - e) / n * 100) + '%';
                    sa.style.opacity = sb.style.opacity = prog(lt, 3.0, 0.8);
                    appear(f1, lt, 5.0); appear(f2, lt, 7.2);
                };
            }
        });
    })();

    // 4 - actual vs expected
    (function () {
        const ra = 130, rb = 100, sa = 3, sb = 1, n = sa + sb, k = 30;
        const e = expected(ra, rb, n), diff = sa - e, delta = k * diff;
        SCENES.push({
            caps: [[1.0, `Zápas skončil ${sa}:${sb}. A uhral ${sa} sety, čakalo sa ${fmt(e, 2)}.`], [4.0, `Rozdiel ${signed(diff, 2)} sa vynásobí K-faktorom ${k}.`], [8.0, `A získa ${signed(Math.round(delta))} bodov, B o toľko stratí.`]],
            dur: 11.5,
            build(root) {
                title(root, '4 · Skutočnosť vs. očakávanie');
                const sc = center(root, 'ex-big ex-big--s', `${sa} : ${sb}`, 72);
                const r1 = row(root, 168, [`<b>${sa}</b><i>uhrané</i>`, '−', `<b>${fmt(e, 2)}</b><i>očakávané</i>`, '=', `<b class="ex-pos">${signed(diff, 2)}</b><i>rozdiel</i>`], 1.4, 0.6);
                const r2 = row(root, 262, [`<b>${signed(diff, 2)}</b>`, '×', `<b>${k}</b><i>K-faktor</i>`, '=', `<b class="ex-pos">${signed(Math.round(delta))}</b><i>body</i>`], 4.4, 0.6);
                const ra_ = center(root, 'ex-after', '', 354, { left: '40px', width: '340px' });
                const rb_ = center(root, 'ex-after', '', 354, { left: '420px', width: '340px' });
                return (lt) => {
                    appear(sc, lt, 0.6);
                    r1(lt); r2(lt);
                    const p = prog(lt, 8.4, 1.6, easeOutCubic);
                    ra_.innerHTML = `<span class="ex-ab ex-ab--a">A</span> ${fmt(ra + delta * p)} <span class="ex-pos">(${signed(Math.round(delta * p))})</span>`;
                    rb_.innerHTML = `<span class="ex-ab ex-ab--b">B</span> ${fmt(rb - delta * p)} <span class="ex-neg">(${signed(-Math.round(delta * p))})</span>`;
                    appear(ra_, lt, 8.2); appear(rb_, lt, 8.2);
                };
            }
        });
    })();

    // 5 - sets, not only wins
    (function () {
        const ra = 130, rb = 100, k = 30;
        const cases = [{ s: [3, 0] }, { s: [3, 2] }].map((c) => {
            const n = c.s[0] + c.s[1];
            c.delta = k * (c.s[0] - expected(ra, rb, n));
            return c;
        });
        SCENES.push({
            caps: [[1.0, 'A (130) proti B (100): dve výhry, rovnaký súper.'], [4.5, `Čistá výhra 3:0 prináša ${signed(Math.round(cases[0].delta))} bodov, tesná 3:2 len ${signed(Math.round(cases[1].delta))}.`], [8.0, 'Viac uhraných setov znamená istejšiu prevahu.']],
            dur: 11.5,
            build(root) {
                title(root, '5 · Počítajú sa sety');
                const cols = cases.map((c, i) => {
                    const left = 40 + i * 380;
                    const score = center(root, 'ex-big ex-big--s', `${c.s[0]} : ${c.s[1]}`, 90, { left: left + 'px', width: '340px' });
                    const track = mk(root, 'ex-track', '', { left: (left + 20) + 'px', top: '186px', width: '300px' });
                    const fill = mk(track, 'ex-fill', '');
                    const val = center(root, 'ex-big ex-pos', signed(Math.round(c.delta)), 232, { left: left + 'px', width: '340px' });
                    const lab = center(root, 'ex-tiny', 'BODOV PRE A', 300, { left: left + 'px', width: '340px' });
                    return { score, track, fill, val, lab, c, i };
                });
                const foot = center(root, 'ex-sub', `R<sub>A</sub> ${ra} · R<sub>B</sub> ${rb} · K ${k}`, 352);
                return (lt) => {
                    cols.forEach((o) => {
                        const at = o.i === 0 ? 1.2 : 4.8;
                        appear(o.score, lt, at); appear(o.track, lt, at + 0.4);
                        o.fill.style.width = (prog(lt, at + 0.8, 1.6, easeInOutCubic) * o.c.delta / 40 * 100) + '%';
                        appear(o.val, lt, at + 1.8); appear(o.lab, lt, at + 1.8);
                    });
                    appear(foot, lt, 1.0);
                };
            }
        });
    })();

    // 6 - a loss can still gain points
    (function () {
        const ra = 80, rb = 160, sa = 2, sb = 3, n = sa + sb, k = 30;
        const e = expected(ra, rb, n), diff = sa - e, delta = k * diff;
        SCENES.push({
            caps: [[1.0, `A (${ra}) prehral s oveľa silnejším B (${rb}), ${sa}:${sb}.`], [5.0, `Systém čakal len ${fmt(e, 2)} setu. A uhral ${sa}, teda viac.`], [8.5, `Za to ${signed(Math.round(delta))} bodov, aj keď zápas prehral.`]],
            dur: 12,
            build(root) {
                title(root, '6 · Aj prehra môže pridať body');
                const a = ball(root, 170, 170, COLORS.sky, 'A');
                const b = ball(root, 630, 170, COLORS.draw, 'B');
                const sc = center(root, 'ex-big ex-big--s', `${sa} : ${sb}`, 84);
                const lc = center(root, 'ex-chip-wrap', '<span class="ex-chip ex-chip--loss">A prehral</span>', 158);
                const an = center(root, 'ex-num', '', 224, { width: '240px', left: '50px' });
                const bn = center(root, 'ex-num', '', 224, { width: '240px', left: '510px' });
                const ex = center(root, 'ex-formula', `očakávané ${fmt(e, 2)} · uhrané ${sa} → ${signed(diff, 2)} × ${k} = <b>${signed(delta, 1)}</b>`, 290, { left: '60px', width: '680px' });
                const win = center(root, 'ex-chip-wrap', '<span class="ex-chip ex-chip--green">Prehra, a predsa body navyše</span>', 366);
                return (lt) => {
                    appear(a, lt, 0.8); appear(b, lt, 0.8); appear(sc, lt, 1.4); appear(lc, lt, 2.2);
                    const p = prog(lt, 6.5, 1.6, easeOutCubic);
                    an.innerHTML = `${fmt(ra + delta * p)} <span class="ex-pos">${signed(Math.round(delta * p))}</span>`;
                    bn.innerHTML = `${fmt(rb - delta * p)} <span class="ex-neg">${signed(-Math.round(delta * p))}</span>`;
                    appear(an, lt, 1.0); appear(bn, lt, 1.0);
                    appear(ex, lt, 5.0); appear(win, lt, 8.7);
                };
            }
        });
    })();

    // 7 - rating journey graph (also shows the K-factor shrinking)
    (function () {
        const plan = [[100, 3, 1], [140, 2, 3], [120, 3, 0], [170, 3, 2], [150, 1, 3], [160, 3, 1], [140, 3, 2], [150, 3, 0]];
        const pts = [{ r: 100 }];
        plan.forEach((m, i) => {
            const prev = pts[i].r, k = K_STAGES[Math.min(i, K_STAGES.length - 1)];
            const n = m[1] + m[2], d = k * (m[1] - expected(prev, m[0], n));
            pts.push({ r: prev + d, d, k, opp: m[0], a: m[1], b: m[2], win: m[1] > m[2] });
        });
        const T0 = 2.4, STEP = 3.0;
        const at = (i) => T0 + (i - 1) * STEP; // time match i (1-based) starts
        const m2 = pts[2], m4 = pts[4];
        SCENES.push({
            caps: [
                [0.8, 'Graf ukazuje rating jedného nového hráča po každom zápase.'],
                [at(1) + 0.8, `1. zápas: výhra ${pts[1].a}:${pts[1].b}, rating ${fmt(100)} → ${fmt(pts[1].r)} (${signed(Math.round(pts[1].d))}).`],
                [at(2) + 0.8, `2. zápas: prehra ${m2.a}:${m2.b} so silnejším súperom, a predsa ${signed(Math.round(m2.d))}.`],
                [at(4) + 0.8, `Výhra nad silnejším súperom (${m4.opp}) prinesie veľký skok: ${signed(Math.round(m4.d))}.`],
                [at(6) + 0.8, 'Kroky sú čoraz menšie: K klesá z 30 na 10.'],
                [at(8) + 1.0, 'Po 8 zápasoch je rating stále červený (menej ako 11 zápasov).']
            ],
            dur: at(8) + 5.5,
            build(root) {
                title(root, '7 · Vývoj ratingu');
                const X0 = 100, X1 = 740, YT = 100, YB = 288;
                const lo = Math.min(...pts.map((p) => p.r)) - 8, hi = Math.max(...pts.map((p) => p.r)) + 8;
                const X = (i) => X0 + (X1 - X0) * i / plan.length;
                const Y = (r) => YB - (YB - YT) * (r - lo) / (hi - lo);
                const NS = 'http://www.w3.org/2000/svg';
                const svg = document.createElementNS(NS, 'svg');
                svg.setAttribute('width', W); svg.setAttribute('height', H);
                svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
                root.appendChild(svg);
                const sv = (name, attrs) => {
                    const e = document.createElementNS(NS, name);
                    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
                    svg.appendChild(e); return e;
                };
                const yBase = Y(100);
                sv('line', { x1: X0 - 10, x2: X1 + 10, y1: yBase, y2: yBase, stroke: COLORS.sky, 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.8 });
                sv('line', { x1: X0 - 10, x2: X0 - 10, y1: YT - 10, y2: YB + 6, stroke: COLORS.ink2, 'stroke-width': 2 });
                const baseLab = mk(root, 'ex-gl', 'štart 100', { left: '8px', top: (yBase - 11) + 'px' });
                const segs = pts.slice(1).map((p, i) => sv('line', { x1: X(i), y1: Y(pts[i].r), x2: X(i), y2: Y(pts[i].r), stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'butt' }));
                const dots = pts.map((p, i) => sv('circle', { cx: X(i), cy: Y(p.r), r: 8, fill: i === 0 ? COLORS.sky : (p.win ? COLORS.sky : COLORS.loss), stroke: COLORS.ink, 'stroke-width': 3, opacity: 0 }));
                const tags = pts.slice(1).map((p, i) => mk(root, 'ex-tag ' + (p.d >= 0 ? 'ex-pos' : 'ex-neg'), `${signed(Math.round(p.d))}`, { left: (X(i + 1) - 30) + 'px', top: (Y(p.r) + (p.d >= 0 ? -42 : 14)) + 'px', width: '60px' }));
                const ks = pts.slice(1).map((p, i) => mk(root, 'ex-kb', '', { left: (X(i + 1) - 24) + 'px', top: '304px', width: '48px', height: (4 + p.k * 0.8) + 'px' }));
                const labs = pts.slice(1).map((p, i) => mk(root, 'ex-ml', `${p.a}:${p.b}<i>vs ${p.opp}</i><i class="ex-kt">K ${p.k}</i>`, { left: (X(i + 1) - 36) + 'px', top: '338px', width: '72px' }));
                const ax = mk(root, 'ex-gl', 'zápas →', { left: '8px', top: '350px' });
                const end = center(root, 'ex-chip-wrap', '<span class="ex-chip ex-chip--red">červená: menej ako 11 zápasov</span>', 0, { top: '26px', left: '400px', width: '370px', textAlign: 'right' });
                return (lt) => {
                    appear(baseLab, lt, 0.6); appear(ax, lt, 1.2);
                    dots[0].setAttribute('opacity', prog(lt, 0.8, 0.5));
                    pts.slice(1).forEach((p, j) => {
                        const i = j + 1, s = at(i);
                        const g = prog(lt, s, 1.1, easeInOutCubic);
                        const x = X(j) + (X(i) - X(j)) * g, y = Y(pts[j].r) + (Y(p.r) - Y(pts[j].r)) * g;
                        segs[j].setAttribute('x2', x); segs[j].setAttribute('y2', y);
                        dots[i].setAttribute('opacity', prog(lt, s + 0.9, 0.3));
                        const col = i === plan.length && lt > at(plan.length) + 1.2 ? COLORS.red : (p.win ? COLORS.sky : COLORS.loss);
                        dots[i].setAttribute('fill', col);
                        appear(tags[j], lt, s + 1.0, 0.5, 8);
                        appear(ks[j], lt, s + 0.2, 0.5, 6);
                        appear(labs[j], lt, s + 0.2, 0.5, 6);
                    });
                    appear(end, lt, at(plan.length) + 1.4);
                };
            }
        });
    })();

    // 8 - stability colours
    SCENES.push({
        caps: [[1.0, 'Farba ratingu v tabuľke ukazuje, ako istý rating je.'], [8.0, 'Neaktívni hráči sú zaradení pod všetkými ostatnými.']],
        dur: 11.5,
        build(root) {
            title(root, '8 · Farba = istota ratingu');
            const defs = [
                [COLORS.red, '#fff', 104, '0 – 10 zápasov', 'Nováčik'],
                [COLORS.orange, COLORS.ink, 112, '11 – 20 zápasov', 'Rozvíjajúci sa'],
                [COLORS.green, '#fff', 131, '21+ zápasov', 'Stabilný'],
                [COLORS.grey, COLORS.ink, 118, 'bez zápasu v sezóne', 'Neaktívny']
            ];
            const rows = defs.map((d, i) => {
                const r = mk(root, 'ex-legend', '', { top: (92 + i * 76) + 'px' });
                mk(r, 'ex-swatch', String(d[2]), { background: d[0], color: d[1] });
                mk(r, 'ex-legtxt', `<b>${d[3]}</b><span>${d[4]}</span>`);
                return r;
            });
            return (lt) => rows.forEach((r, i) => appear(r, lt, 1.6 + i * 2.0, 0.7, 16));
        }
    });

    // 9 - recap
    SCENES.push({
        caps: [[1.0, 'Rating je výkon proti očakávaniu, nielen výhra či prehra.']],
        dur: 8.6,
        build(root) {
            title(root, 'Zhrnutie');
            const items = ['Všetci začínajú na <b>100</b>', 'Rozdiel ratingov určí <b>očakávané sety</b>', 'Zmena = <b>K × (uhrané − očakávané)</b>', 'K klesá z <b>30 na 10</b>, farba ukazuje istotu'];
            const rows = items.map((h, i) => {
                const r = mk(root, 'ex-recap', `<span class="ex-no">${i + 1}</span><span>${h}</span>`, { top: (96 + i * 70) + 'px' });
                return r;
            });
            return (lt) => rows.forEach((r, i) => appear(r, lt, 0.8 + i * 1.6, 0.7, 14));
        }
    });

    // ---------- timeline ----------
    let TOTAL = 0;
    SCENES.forEach((s) => { s.start = TOTAL; TOTAL += s.dur; });

    // ---------- player ----------
    let host = null, stage = null, capsEl = null, track = null, fillEl = null, playBtn = null, label = null;
    let built = false, raf = 0, playing = false, clock = 0, last = 0, lastSceneIdx = -1;

    function init() {
        host = document.getElementById('ratingExplainer');
        if (!host || built) return !!host;
        host.innerHTML = '';
        const view = mk(host, 'ex-view');
        stage = mk(view, 'ex-stage', '', { width: W + 'px', height: H + 'px' });
        capsEl = mk(host, 'ex-caps');
        const bar = mk(host, 'ex-bar-ctl');
        const prev = document.createElement('button');
        prev.type = 'button'; prev.className = 'ex-btn'; prev.textContent = '‹'; prev.setAttribute('aria-label', 'Predchádzajúci krok');
        playBtn = document.createElement('button');
        playBtn.type = 'button'; playBtn.className = 'ex-btn';
        const next = document.createElement('button');
        next.type = 'button'; next.className = 'ex-btn'; next.textContent = '›'; next.setAttribute('aria-label', 'Ďalší krok');
        track = mk(null, 'ex-progress');
        fillEl = mk(track, 'ex-progress__fill');
        label = mk(null, 'ex-step');
        bar.append(prev, playBtn, next, track, label);

        SCENES.forEach((s) => {
            s.root = mk(stage, 'ex-scene');
            s.capRoot = mk(capsEl, 'ex-capgroup');
            s.update = s.build(s.root);
            s.capEls = s.caps.map((c) => mk(s.capRoot, 'ex-cap', c[1]));
        });

        playBtn.addEventListener('click', () => (playing ? pause() : play()));
        prev.addEventListener('click', () => jump(-1));
        next.addEventListener('click', () => jump(1));
        track.addEventListener('click', (e) => {
            const r = track.getBoundingClientRect();
            clock = clamp01((e.clientX - r.left) / r.width) * TOTAL;
            seek(clock);
        });
        if (window.ResizeObserver) new ResizeObserver(fit).observe(view);
        built = true;
        return true;
    }

    function fit() {
        if (!stage) return;
        const w = stage.parentNode.clientWidth;
        if (w) stage.style.transform = `scale(${w / W})`;
    }

    function sceneIndex(t) {
        for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start) return i;
        return 0;
    }

    function seek(t) {
        t = Math.min(Math.max(t, 0), TOTAL - 0.001);
        const idx = sceneIndex(t);
        SCENES.forEach((s, i) => {
            const on = i === idx;
            s.root.style.display = s.capRoot.style.display = on ? '' : 'none';
            if (!on) return;
            const lt = t - s.start;
            const fade = Math.min(prog(lt, 0, 0.5), 1 - prog(lt, s.dur - 0.5, 0.5));
            s.root.style.opacity = i === SCENES.length - 1 ? prog(lt, 0, 0.5) : fade;
            s.update(lt);
            // only the latest three captions stay on screen so the block keeps a fixed height
            let shown = -1;
            s.caps.forEach((c, j) => { if (lt >= c[0]) shown = j; });
            s.caps.forEach((c, j) => {
                s.capEls[j].style.display = j < shown - 2 ? 'none' : '';
                appear(s.capEls[j], lt, c[0], 0.6, 8);
            });
        });
        lastSceneIdx = idx;
        fillEl.style.width = (t / TOTAL * 100) + '%';
        label.textContent = `${idx + 1} / ${SCENES.length}`;
    }

    function frame(now) {
        if (!playing) return;
        clock += Math.min((now - last) / 1000, 0.1);
        last = now;
        if (clock >= TOTAL) clock = 0;
        seek(clock);
        raf = requestAnimationFrame(frame);
    }
    function setBtn() {
        playBtn.textContent = playing ? '❚❚' : '▶';
        playBtn.setAttribute('aria-label', playing ? 'Pozastaviť' : 'Prehrať');
    }
    function play() {
        if (!built) return;
        playing = true; setBtn();
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
    }
    function pause() {
        playing = false; setBtn();
        cancelAnimationFrame(raf);
    }
    function jump(dir) {
        const idx = Math.min(Math.max(sceneIndex(clock) + dir, 0), SCENES.length - 1);
        clock = SCENES[idx].start;
        seek(clock);
    }

    window.RatingExplainer = {
        // called when the modal opens: start from the top and autoplay
        restart() {
            if (!init()) return;
            fit();
            clock = 0;
            seek(0);
            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduce) { pause(); } else { play(); }
        },
        // called when the modal closes
        stop() { if (built) pause(); },
        seek(t) { if (init()) { fit(); clock = t; seek(t); } },
        total() { return TOTAL; },
        scenes() { return SCENES.map((s) => ({ start: s.start, dur: s.dur })); }
    };
})();
