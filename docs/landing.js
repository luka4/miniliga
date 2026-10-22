// Home page behaviour: fitted wordmark, count-up figures, scroll reveals.
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Wordmark: size each line so it spans the full width of the hero ---
    function fitLines() {
        const h1 = document.getElementById('heroName');
        if (!h1) return;
        const lines = h1.querySelectorAll('.fit-line');
        const stacked = window.matchMedia('(max-width: 700px)').matches;
        // 1.013: the glyphs end a little inside their advance widths, so overscan to reach the margins
        const width = h1.clientWidth * 1.013;
        if (!width) return;
        // Measure the whole text (or each line) at a reference size, then scale to fit.
        const ref = 100;
        const probe = document.createElement('span');
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:inherit;font-size:${ref}px;letter-spacing:0.04em;`;
        h1.appendChild(probe);
        // the last letter's trailing spacing (0.04em) is not visible ink
        const measure = text => { probe.textContent = text; return probe.getBoundingClientRect().width - ref * 0.04; };
        if (stacked) {
            let size = Infinity;
            lines.forEach(l => { size = Math.min(size, ref * width / measure(l.textContent)); });
            h1.style.fontSize = size + 'px';
        } else {
            const text = Array.from(lines).map(l => l.textContent).join('');
            h1.style.fontSize = (ref * width / measure(text)) + 'px';
        }
        probe.remove();
        h1.classList.add('is-fitted');
    }

    // --- Wordmark filled with video: the footage is painted through the letter shapes ---
    function initVideoWordmark() {
        const mark = document.querySelector('.hero__mark');
        const h1 = document.getElementById('heroName');
        const video = document.getElementById('heroVideo');
        if (!mark || !h1 || !video) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'hero__canvas';
        canvas.setAttribute('aria-hidden', 'true');
        mark.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) { canvas.remove(); return; }

        // Calm the footage: half speed so the letters read as a name, not as flicker
        video.playbackRate = 0.5;
        video.addEventListener('loadedmetadata', () => { video.playbackRate = 0.5; });

        let glyphs = [];
        let w = 0, h = 0, dpr = 1, size = 0;

        function layout() {
            const box = h1.getBoundingClientRect();
            if (!box.width || !h1.classList.contains('is-fitted')) return false;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = box.width; h = box.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            size = parseFloat(getComputedStyle(h1).fontSize);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.04}px`;
            const ascent = ctx.measureText('M').fontBoundingBoxAscent || size * 1.17;
            glyphs = Array.from(h1.querySelectorAll('.fit-line')).map(line => {
                const range = document.createRange();
                range.selectNodeContents(line);
                const r = range.getBoundingClientRect();
                return { text: line.textContent, x: r.left - box.left, y: r.top - box.top + ascent };
            });
            return true;
        }

        function draw() {
            if (!glyphs.length || video.readyState < 2) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = `400 ${size}px Anton, Impact, sans-serif`;
            if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.04}px`;
            ctx.fillStyle = '#ffffff';
            glyphs.forEach(g => ctx.fillText(g.text, g.x, g.y));
            // Video only where letters are; a fog of white stays so dark footage never swallows a letter
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.26;
            const vw = video.videoWidth, vh = video.videoHeight;
            const scale = Math.max(w / vw, h / vh);
            const sw = w / scale, sh = h / scale;
            const sx = (vw - sw) / 2, sy = (vh - sh) * 0.72;
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
            ctx.globalAlpha = 1;
        }

        let visible = true;
        function tick() {
            if (visible && !document.hidden) draw();
            if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(tick);
            else requestAnimationFrame(tick);
        }

        function ready() {
            if (!layout()) return;
            mark.classList.add('has-canvas');
            draw();
        }

        // Refit whenever the wordmark is re-measured
        const refit = () => { if (layout()) { mark.classList.add('has-canvas'); draw(); } };
        new MutationObserver(refit).observe(h1, { attributes: true, attributeFilter: ['style', 'class'] });
        window.addEventListener('resize', () => requestAnimationFrame(refit));
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(mark);
        }
        video.addEventListener('loadeddata', ready);
        if (video.readyState >= 2) ready();
        tick();
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
        const vid = document.getElementById('heroVideo');
        if (vid && reduceMotion) { vid.removeAttribute('autoplay'); vid.pause(); }
        initVideoWordmark();
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
        setTimeout(fitLines, 500);
        if (document.fonts) {
            // The display face is requested lazily: load it explicitly, then fit
            const done = () => fitLines();
            document.fonts.load('400 100px Anton').then(done, done);
            document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', done);
        }
    });
})();
