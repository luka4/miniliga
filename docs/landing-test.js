// TEST copy of landing.js (ball-rally intro + KOŠICKA); used by test.html only.
// Home page behaviour: fitted wordmark, count-up figures, scroll reveals.
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Wordmark: one line, sized to span the full width of the hero ---
    let fontsReady = false;
    let introStarted = false;

    function fitLines() {
        const h1 = document.getElementById('heroName');
        if (!h1) return;
        const mark = h1.parentElement;
        const letters = h1.querySelectorAll('.hero__letter');
        // 1.013: the glyphs end a little inside their advance widths, so overscan to reach the margins
        const width = h1.clientWidth * 1.013;
        if (!width) return;
        const LANE = 0.19;      // room (in word sizes) kept free after the A for the bouncing ball
        // Measure the whole word at a reference size, then scale to fit.
        const ref = 100;
        const probe = document.createElement('span');
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:inherit;font-size:${ref}px;letter-spacing:0.04em;`;
        h1.appendChild(probe);
        probe.textContent = Array.from(letters).map(l => l.textContent).join('');
        // the last letter's trailing spacing (0.04em) is not visible ink
        const measured = probe.getBoundingClientRect().width - ref * 0.04;
        h1.style.fontSize = (ref * width / (measured + ref * LANE * 1.013)) + 'px';
        probe.remove();
        mark.style.setProperty('--wm', h1.style.fontSize);
        if (!introStarted && !reduceMotion) { h1.classList.add('is-anim'); mark.classList.add('is-anim'); }
        h1.classList.add('is-fitted');
        if (fontsReady) startIntro(h1, letters);
    }

    // --- Intro: a ping-pong rally. The ball is hit in from the right for each letter, drives it into place,
    // and rebounds; the rally speeds up and ends in a smash. Then the whole word KOŠICKA drops in above it. ---
    const wait = anims => Promise.all(anims.map(a => a.finished.catch(() => {})));

    // Where the ball rests: in the free lane right after the A, on the baseline of the word
    function restGeometry(h1, lastLetter, r) {
        const m = h1.parentElement.getBoundingClientRect(), b = lastLetter.getBoundingClientRect();
        return { x: b.right - m.left + r * 0.2, y: b.bottom - m.top - b.height * 0.04 - r };
    }

    async function startIntro(h1, letters) {
        if (introStarted) return;
        introStarted = true;
        const mark = h1.parentElement;
        const ball = mark.querySelector('.hero__ball');
        const ks = mark.querySelectorAll('.hero__k');
        const done = () => { h1.classList.remove('is-anim'); mark.classList.remove('is-anim'); };
        if (reduceMotion || !h1.animate || !ball) { done(); return; }

        const wm = parseFloat(h1.style.fontSize);
        const r = Math.max(wm * 0.085, 11);
        const rise = wm * 0.17;
        ball.style.width = ball.style.height = r + 'px';
        ball.classList.add('is-live');
        const flight = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
        const n = letters.length;

        for (let i = 0; i < n; i++) {
            const el = letters[i];
            const last = i === n - 1;
            const t = i / (n - 1);
            const d = 270 - 140 * t;            // the rally speeds up
            const total = d / 0.62;             // flight in, then the rebound out
            // measured against the mark, so a recoil transform on the word cannot skew the geometry
            const m = mark.getBoundingClientRect(), b = el.getBoundingClientRect();
            const left = b.left - m.left;
            const dist = h1.clientWidth - left;
            const cx = left + b.width / 2 - r / 2;
            const hitY = b.top - m.top + b.height * 0.1 - r / 2;
            el.classList.add('is-in');

            const letterAnim = el.animate([
                { transform: `translateX(${dist}px) scaleX(1.35)` },
                { transform: 'translateX(0) scaleX(1)' }
            ], { duration: d, easing: flight });

            let ballX, ballY;
            if (!last) {
                ballX = ball.animate([
                    { translate: `${cx + dist}px 0`, easing: flight },
                    { translate: `${cx}px 0`, offset: 0.62, easing: 'ease-in' },
                    { translate: `${cx + dist}px 0` }
                ], { duration: total, fill: 'forwards' });
                ballY = ball.animate([
                    { transform: `translateY(${hitY - rise}px) scale(1, 1)`, easing: 'cubic-bezier(0.55, 0, 1, 0.6)' },
                    { transform: `translateY(${hitY}px) scale(1.25, 0.75)`, offset: 0.62, easing: 'cubic-bezier(0, 0.4, 0.45, 1)' },
                    { transform: `translateY(${hitY - rise}px) scale(1, 1)` }
                ], { duration: total, fill: 'forwards' });
            } else {
                // the last hit: the ball drives the A in, then arcs over to the free lane after the A,
                // drops to the baseline there and bounces lower and lower until it comes to rest
                // `m` and `b` were measured before the letter started moving
                const rest = { x: b.right - m.left + r * 0.2, y: b.bottom - m.top - b.height * 0.04 - r };
                const heights = [0.22, 0.12, 0.065, 0.032].map(f => f * wm);
                const times = heights.map(h => Math.sqrt(h / heights[0]) * 440);
                const arc = 640;
                const span = d + arc + times.reduce((a, b) => a + b, 0);
                const up = 'cubic-bezier(0, 0.4, 0.45, 1)', down = 'cubic-bezier(0.55, 0, 1, 0.6)';
                const squash = 'scale(1.3, 0.7)';
                const frames = [
                    { transform: `translateY(${hitY - rise}px) scale(1, 1)`, easing: down },
                    { transform: `translateY(${hitY}px) scale(1.25, 0.75)`, offset: d / span, easing: up },
                    { transform: `translateY(${hitY - rise * 1.6}px) scale(1, 1)`, offset: (d + arc * 0.3) / span, easing: down },
                    { transform: `translateY(${rest.y}px) ${squash}`, offset: (d + arc) / span, easing: up }
                ];
                let at = d + arc;
                heights.forEach((h, k) => {
                    frames.push({ transform: `translateY(${rest.y - h}px) scale(1, 1)`, offset: (at + times[k] / 2) / span, easing: down });
                    at += times[k];
                    frames.push({ transform: `translateY(${rest.y}px) ${squash}`, offset: Math.min(1, at / span), easing: up });
                });
                ballX = ball.animate([
                    { translate: `${cx + dist}px 0`, easing: flight },
                    { translate: `${cx}px 0`, offset: d / span, easing: 'ease-in-out' },
                    { translate: `${rest.x}px 0`, offset: (d + arc) / span },
                    { translate: `${rest.x}px 0` }
                ], { duration: span, fill: 'forwards' });
                ballY = ball.animate(frames, { duration: span, fill: 'forwards' });
            }

            await letterAnim.finished.catch(() => {});
            // impact: the letter squashes, flashes the accent colour, and the word recoils
            const k = wm * (last ? 0.02 : 0.006);
            el.animate([
                { transform: 'scale(1.12, 0.86)' }, { transform: 'scale(0.98, 1.03)', offset: 0.55 }, { transform: 'scale(1, 1)' }
            ], { duration: last ? 380 : 240, easing: 'ease-out' });
            el.animate([{ color: 'var(--color-highlight)' }, { color: '#fff' }], { duration: last ? 600 : 380, easing: 'ease-out' });
            h1.animate([
                { transform: 'translateX(0)' }, { transform: `translateX(${-k}px)` }, { transform: 'translateX(0)' }
            ], { duration: last ? 320 : 180, easing: 'ease-out' });
            if (!last) await wait([ballX, ballY]);
        }
        h1.classList.remove('is-anim');
        // the ball stays resting after the A; a resize moves it to the new resting place
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => {
                ball.getAnimations().forEach(a => a.cancel());
                const w = parseFloat(h1.style.fontSize);
                const rr = Math.max(w * 0.085, 11);
                ball.style.width = ball.style.height = rr + 'px';
                const g = restGeometry(h1, letters[letters.length - 1], rr);
                ball.style.translate = `${g.x}px 0`;
                ball.style.transform = `translateY(${g.y}px)`;
            });
        });

        // KOŠICKA drops in as one whole word, in the accent colour
        const tag = mark.querySelector('.hero__kosicka');
        ks.forEach(k => k.classList.add('is-in'));
        tag.animate([
            { transform: 'translateY(-70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }
        ], { duration: 360, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' });
        setTimeout(() => mark.classList.remove('is-anim'), 360);
    }

    // --- Figures count up the first time they receive a value ---
    function countUp(el, target) {
        if (reduceMotion || !(target > 0)) { el.textContent = target.toLocaleString('sk-SK'); return; }
        const start = performance.now();
        const dur = 1100;
        const tick = now => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased).toLocaleString('sk-SK');
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function watchCounts() {
        document.querySelectorAll('.count').forEach(el => {
            let done = false;
            const obs = new MutationObserver(() => {
                if (done) return;
                const n = parseInt(el.textContent.replace(/\s/g, ''), 10);
                if (!Number.isFinite(n)) return;
                done = true;
                obs.disconnect();
                countUp(el, n);
            });
            obs.observe(el, { childList: true, characterData: true, subtree: true });
        });
    }

    // --- Sections rise in once as they enter the viewport ---
    function initReveal() {
        const items = document.querySelectorAll('[data-reveal]');
        if (!('IntersectionObserver' in window) || reduceMotion) return;
        document.documentElement.classList.add('js-reveal');
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        items.forEach(el => io.observe(el));
    }

    // Reveal match rows with a short stagger when their lists get filled in
    function staggerRows() {
        if (reduceMotion) return;
        ['latestRoundContainer', 'prevRoundContainer', 'upcomingList', 'topGainersList', 'topEffectivenessList', 'upsetContainer']
            .forEach(id => {
                const box = document.getElementById(id);
                if (!box) return;
                new MutationObserver(() => {
                    Array.from(box.querySelectorAll('.match-row, .top-player-row, .upset-card')).forEach((row, i) => {
                        if (row.dataset.staggered) return;
                        row.dataset.staggered = '1';
                        row.style.setProperty('--i', Math.min(i, 12));
                        row.classList.add('row-in');
                    });
                }).observe(box, { childList: true, subtree: true });
            });
    }

    document.addEventListener('DOMContentLoaded', () => {
        watchCounts();
        initReveal();
        staggerRows();
        fitLines();
        // The page content is hidden (zero width) until the loader finishes: refit when it appears
        const h1 = document.getElementById('heroName');
        if (h1 && 'ResizeObserver' in window) {
            let lastW = 0;
            new ResizeObserver(() => { if (h1.clientWidth !== lastW) { lastW = h1.clientWidth; fitLines(); } }).observe(h1);
        }
        window.addEventListener('resize', fitLines);
        // Never leave the title hidden if the font is slow: fit with the fallback face, refit on load
        setTimeout(() => { fontsReady = true; fitLines(); }, 800);
        if (document.fonts) {
            // The display face is requested lazily: load it explicitly, then fit and start the intro
            const done = () => { fontsReady = true; fitLines(); };
            document.fonts.load('400 100px Anton').then(done, done);
            document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', done);
        }
    });
})();
