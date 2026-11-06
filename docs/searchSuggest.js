/* searchSuggest.js
 * Accent-insensitive suggestions for every <input list="..."> on the page.
 * Native <datalist> matching is diacritic-strict ("Zarik" does not find "Marian ZÁRIK"),
 * so the native list is detached and replaced by a small dropdown that reads the same
 * <datalist> options (pages keep filling them as before) and matches with accents folded.
 * On Enter / blur an unaccented value that matches exactly one option is replaced by it,
 * so the existing page handlers (which compare exact names) keep working.
 */
(function () {
    'use strict';

    const MAX_ITEMS = 50;

    const foldChar = (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const fold = (s) => Array.from(s || '').map(foldChar).join('').trim();

    // Folded text plus, for each folded char, the index of the original char (for highlighting).
    const foldWithMap = (s) => {
        let text = '';
        const map = [];
        Array.from(s).forEach((ch, i) => {
            const f = foldChar(ch);
            text += f;
            for (let k = 0; k < f.length; k++) map.push(i);
        });
        return { text, map, chars: Array.from(s) };
    };

    const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const injectStyles = () => {
        if (document.getElementById('search-suggest-styles')) return;
        const style = document.createElement('style');
        style.id = 'search-suggest-styles';
        style.textContent = `
.search-suggest {
  position: fixed; z-index: 10000; margin: 0; padding: 4px 0; list-style: none;
  max-height: 280px; overflow-y: auto; background: #fff; color: #0f172a;
  border: 2px solid #0f172a; font: 500 15px var(--font-sans, system-ui, sans-serif);
}
.search-suggest[hidden] { display: none; }
.search-suggest li { padding: 8px 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-suggest li.active, .search-suggest li:hover { background: #e0f2fe; }
.search-suggest mark { background: transparent; color: inherit; font-weight: 700; text-decoration: underline; }
`;
        document.head.appendChild(style);
    };

    const enhance = (input) => {
        if (input.dataset.suggestEnhanced) return;
        const listId = input.getAttribute('list');
        if (!listId) return;
        input.dataset.suggestEnhanced = '1';
        input.removeAttribute('list');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');

        const box = document.createElement('ul');
        box.className = 'search-suggest';
        box.id = `${input.id || listId}-suggest`;
        box.setAttribute('role', 'listbox');
        box.hidden = true;
        document.body.appendChild(box);
        input.setAttribute('aria-controls', box.id);

        let items = [];
        let active = -1;

        const options = () => {
            const dl = document.getElementById(listId);
            if (!dl) return [];
            const seen = new Set();
            return Array.from(dl.options).map(o => o.value).filter(v => v && !seen.has(v) && seen.add(v));
        };

        // Matches ranked: whole-name prefix, then word prefix, then substring.
        const matches = (query) => {
            const q = fold(query);
            const all = options();
            if (!q) return all.map(v => ({ value: v, start: -1, len: 0 }));
            const ranked = [];
            all.forEach(v => {
                const f = foldWithMap(v);
                const idx = f.text.indexOf(q);
                if (idx < 0) return;
                let rank = 2;
                if (idx === 0) rank = 0;
                else if (/[\s\-"'(.]/.test(f.text[idx - 1])) rank = 1;
                else {
                    // prefer a word-start occurrence later in the name
                    const re = new RegExp(`(^|[\\s\\-"'(.])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
                    const m = re.exec(f.text);
                    if (m) { rank = 1; ranked.push({ value: v, rank, f, idx: m.index + m[1].length, qlen: q.length }); return; }
                }
                ranked.push({ value: v, rank, f, idx, qlen: q.length });
            });
            ranked.sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value, 'sk', { sensitivity: 'base' }));
            return ranked.map(r => {
                const startChar = r.f.map[r.idx];
                const endChar = r.f.map[r.idx + r.qlen - 1];
                return { value: r.value, start: startChar, len: endChar - startChar + 1 };
            });
        };

        const position = () => {
            const r = input.getBoundingClientRect();
            box.style.left = `${r.left}px`;
            box.style.top = `${r.bottom}px`;
            box.style.minWidth = `${r.width}px`;
            box.style.maxWidth = `${Math.max(r.width, Math.min(420, window.innerWidth - r.left - 8))}px`;
        };

        const close = () => {
            box.hidden = true;
            active = -1;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
        };

        const setActive = (i) => {
            const lis = box.children;
            if (active >= 0 && lis[active]) lis[active].classList.remove('active');
            active = i;
            if (active >= 0 && lis[active]) {
                lis[active].classList.add('active');
                lis[active].scrollIntoView({ block: 'nearest' });
                input.setAttribute('aria-activedescendant', lis[active].id);
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        };

        const render = () => {
            items = matches(input.value).slice(0, MAX_ITEMS);
            // Nothing to suggest, or the value already is the single exact option
            if (!items.length || (items.length === 1 && items[0].value === input.value)) { close(); return; }
            box.innerHTML = items.map((it, i) => {
                let label = escapeHtml(it.value);
                if (it.start >= 0) {
                    const chars = Array.from(it.value);
                    label = escapeHtml(chars.slice(0, it.start).join(''))
                        + '<mark>' + escapeHtml(chars.slice(it.start, it.start + it.len).join('')) + '</mark>'
                        + escapeHtml(chars.slice(it.start + it.len).join(''));
                }
                return `<li role="option" id="${box.id}-${i}">${label}</li>`;
            }).join('');
            active = -1;
            position();
            box.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        };

        const choose = (value) => {
            input.value = value;
            close();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Replace an unaccented / partial value with the option it unambiguously names.
        const resolve = () => {
            const val = input.value.trim();
            if (!val) return;
            const opts = options();
            if (opts.some(o => o.toLowerCase() === val.toLowerCase())) return;
            const q = fold(val);
            const exact = opts.filter(o => fold(o) === q);
            if (exact.length === 1) { input.value = exact[0]; return; }
            const partial = matches(val);
            if (partial.length === 1) input.value = partial[0].value;
        };

        input.addEventListener('input', (e) => { if (e.isTrusted) render(); });
        input.addEventListener('focus', render);
        input.addEventListener('click', () => { if (box.hidden) render(); });
        input.addEventListener('blur', () => { resolve(); close(); });

        // Capture so this runs before the page's own Enter handlers.
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (box.hidden) { render(); if (box.hidden) return; }
                e.preventDefault();
                const n = items.length;
                setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
            } else if (e.key === 'Enter') {
                if (!box.hidden && active >= 0 && items[active]) {
                    input.value = items[active].value;
                    close();
                } else {
                    resolve();
                    close();
                }
            } else if (e.key === 'Escape') {
                if (!box.hidden) { e.preventDefault(); close(); }
            } else if (e.key === 'Tab') {
                if (!box.hidden && active >= 0 && items[active]) input.value = items[active].value;
            }
        }, true);

        // mousedown (not click) so the input does not blur first
        box.addEventListener('mousedown', (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            e.preventDefault();
            const i = Array.from(box.children).indexOf(li);
            if (items[i]) choose(items[i].value);
        });

        const reposition = () => { if (!box.hidden) position(); };
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
    };

    const init = () => {
        injectStyles();
        document.querySelectorAll('input[list]').forEach(enhance);
        // Inputs added later (re-rendered sections)
        new MutationObserver(() => document.querySelectorAll('input[list]').forEach(enhance))
            .observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
