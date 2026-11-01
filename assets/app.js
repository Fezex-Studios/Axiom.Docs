/* Axiom docs: theme, mobile nav, search, copy buttons, table filters, toc highlight. No network. */
(function () {
  'use strict';
  var root = document.documentElement;
  var ROOT = (function () {
    var s = document.querySelector('script[src$="assets/app.js"]');
    return s ? s.getAttribute('src').replace(/assets\/app\.js$/, '') : '../';
  })();

  // ── theme ───────────────────────────────────────────────
  var themeBtn = document.querySelector('.theme-btn');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('axiom-theme', next); } catch (e) {}
  });

  // ── mobile nav ──────────────────────────────────────────
  var menuBtn = document.querySelector('.menu-btn');
  var scrim = document.querySelector('.scrim');
  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (scrim) scrim.hidden = !open;
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setNav(!document.body.classList.contains('nav-open')); });
  if (scrim) scrim.addEventListener('click', function () { setNav(false); });
  var active = document.querySelector('.side-nav a.active');
  if (active && active.scrollIntoView) { try { active.scrollIntoView({ block: 'center' }); } catch (e) {} }

  // ── copy buttons ────────────────────────────────────────
  document.querySelectorAll('.doc pre').forEach(function (pre) {
    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-btn'; b.textContent = 'Copy';
    b.addEventListener('click', function () {
      var text = pre.innerText;
      function done() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1200); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
    wrap.appendChild(b);
  });

  // ── table filters (big tables) ──────────────────────────
  document.querySelectorAll('.doc .table-wrap').forEach(function (w) {
    var rows = w.querySelectorAll('tbody tr');
    if (rows.length < 25) return;
    var bar = document.createElement('div');
    bar.className = 'table-filter';
    var input = document.createElement('input');
    input.type = 'search'; input.placeholder = 'Filter these ' + rows.length + ' rows…';
    var count = document.createElement('span');
    bar.appendChild(input); bar.appendChild(count);
    w.parentNode.insertBefore(bar, w);
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) {
        var ok = !q || r.textContent.toLowerCase().indexOf(q) >= 0;
        r.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      count.textContent = q ? shown + ' shown' : '';
    });
  });

  // ── toc highlight ───────────────────────────────────────
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[decodeURIComponent(a.getAttribute('href').slice(1))] = a; });
    var visible = {};
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var first = null;
      document.querySelectorAll('.doc h2[id], .doc h3[id]').forEach(function (h) { if (!first && visible[h.id]) first = h.id; });
      if (first) { tocLinks.forEach(function (a) { a.classList.remove('on'); }); if (map[first]) map[first].classList.add('on'); }
    }, { rootMargin: '-60px 0px -70% 0px' });
    document.querySelectorAll('.doc h2[id], .doc h3[id]').forEach(function (h) { obs.observe(h); });
  }

  // ── search ──────────────────────────────────────────────
  var input = document.getElementById('search');
  var box = document.getElementById('search-results');
  if (!input || !box) return;
  var data = null, sel = -1, results = [];

  function load() {
    if (data) return data;
    var raw = window.AXIOM_SEARCH || [];
    data = raw.map(function (p) {
      return { t: p.t, u: p.u, s: p.s, d: p.d || '', h: p.h || [], tl: p.t.toLowerCase(), xl: (p.x || '').toLowerCase(), x: p.x || '', dl: (p.d || '').toLowerCase() };
    });
    return data;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>');
    });
    return out;
  }
  function snippet(p, terms) {
    var best = -1;
    for (var i = 0; i < terms.length && best < 0; i++) best = p.xl.indexOf(terms[i]);
    if (best < 0) return p.d;
    var start = Math.max(0, best - 60);
    var s = p.x.slice(start, start + 180);
    return (start > 0 ? '… ' : '') + s + ' …';
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!terms.length) return [];
    var out = [];
    load().forEach(function (p) {
      var score = 0, all = true, headHit = null;
      terms.forEach(function (t) {
        var s = 0;
        if (p.tl === t) s += 120;
        if (p.tl.indexOf(t) >= 0) s += 40;
        if (p.dl.indexOf(t) >= 0) s += 10;
        for (var i = 0; i < p.h.length; i++) {
          var hl = p.h[i][1].toLowerCase();
          if (hl.indexOf(t) >= 0) { s += (hl === t ? 30 : 16); if (!headHit) headHit = p.h[i]; break; }
        }
        var idx = p.xl.indexOf(t), n = 0;
        while (idx >= 0 && n < 25) { n++; idx = p.xl.indexOf(t, idx + t.length); }
        s += Math.min(n, 25) * 1.2;
        if (s === 0) all = false;
        score += s;
      });
      if (all && score > 0) {
        if (/Archive/.test(p.s)) score *= 0.45;
        if (/Reference/.test(p.s)) score *= 0.8;
        // whole phrase bonus
        if (terms.length > 1 && p.xl.indexOf(q.toLowerCase()) >= 0) score += 25;
        out.push({ p: p, score: score, head: headHit, terms: terms });
      }
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 30);
  }
  function render() {
    var q = input.value.trim();
    if (!q) { box.hidden = true; return; }
    results = search(q);
    sel = results.length ? 0 : -1;
    if (!results.length) { box.innerHTML = '<div class="r-none">No results for “' + esc(q) + '”.</div>'; box.hidden = false; return; }
    box.innerHTML = results.map(function (r, i) {
      var url = ROOT + r.p.u + (r.head ? '#' + r.head[0] : '');
      return '<a role="option" href="' + url + '"' + (i === 0 ? ' class="sel"' : '') + '>' +
        '<span class="r-sec">' + esc(r.p.s) + '</span>' +
        '<div class="r-title">' + mark(r.p.t, r.terms) + (r.head ? ' <span class="r-head">› ' + mark(r.head[1], r.terms) + '</span>' : '') + '</div>' +
        '<div class="r-snip">' + mark(snippet(r.p, r.terms), r.terms) + '</div></a>';
    }).join('');
    box.hidden = false;
  }
  function move(d) {
    var links = box.querySelectorAll('a');
    if (!links.length) return;
    if (sel >= 0) links[sel].classList.remove('sel');
    sel = (sel + d + links.length) % links.length;
    links[sel].classList.add('sel');
    links[sel].scrollIntoView({ block: 'nearest' });
  }
  var timer;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 70); });
  input.addEventListener('focus', function () { if (input.value.trim()) render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { var l = box.querySelectorAll('a')[sel]; if (l) { e.preventDefault(); window.location.href = l.getAttribute('href'); } }
    else if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) box.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
  });
})();
