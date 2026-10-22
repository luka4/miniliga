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
        const letters = h1.querySelectorAll('.hero__letter');
        // 1.013: the glyphs end a little inside their advance widths, so overscan to reach the margins
        const width = h1.clientWidth * 1.013;
        if (!width) return;
        // Measure the whole word at a reference size, then scale to fit.
        const ref = 100;
        const probe = document.createElement('span');
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:inherit;font-size:${ref}px;letter-spacing:0.04em;`;
        h1.appendChild(probe);
        probe.textContent = Array.from(letters).map(l => l.textContent).join('');
        // the last letter's trailing spacing (0.04em) is not visible ink
        const measured = probe.getBoundingClientRect().width - ref * 0.04;
        h1.style.fontSize = (ref * width / measured) + 'px';
        probe.remove();
        if (!introStarted && !reduceMotion) h1.classList.add('is-anim');
        h1.classList.add('is-fitted');
        if (fontsReady) startIntro(h1, letters);
    }

    // --- Intro: the letters run in from the right one after another, each starting once the previous has landed ---
    function startIntro(h1, letters) {
        if (introStarted) return;
        introStarted = true;
        if (reduceMotion || !h1.animate) { h1.classList.remove('is-anim'); return; }
        let i = 0;
        const next = () => {
            if (i >= letters.length) { h1.classList.remove('is-anim'); return; }
            const el = letters[i++];
            const dist = h1.clientWidth - el.offsetLeft;
            el.classList.add('is-in');
            el.animate(
                [{ transform: `translateX(${dist}px)` }, { transform: 'translateX(0)' }],
                { duration: 340, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
            ).onfinish = next;
        };
        next();
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
