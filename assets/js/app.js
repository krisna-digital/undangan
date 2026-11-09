/* Undangan digital: semua konten dibaca dari data.json.
 * Mode pratinjau (?preview=1 di dalam iframe) menerima data dari editor lewat postMessage. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = (v) => esc(v).replace(/\r?\n/g, '<br>');

  const params = new URLSearchParams(location.search);
  const guest = (params.get('untuk') || params.get('to') || '').trim().slice(0, 80);
  const PREVIEW = params.has('preview') && window.parent !== window;

  const blobs = new Map(); // path -> object URL (hanya mode pratinjau)
  const state = { data: null, opened: PREVIEW, timers: [], io: null, wishes: [], lb: { list: [], i: 0 } };

  const src = (p) => {
    p = String(p || '').trim();
    if (!p) return '';
    if (blobs.has(p)) return blobs.get(p);
    if (/^(javascript|vbscript):/i.test(p)) return '';
    return p;
  };
  const link = (u) => {
    u = String(u || '').trim();
    return !u || /^(javascript|vbscript|data):/i.test(u) ? '#' : u;
  };
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) ? c.trim() : '');
  const safeFont = (f) => String(f || '').replace(/[^\w\s-]/g, '').trim();
  const imageTransform = (v) => { v = v && typeof v === 'object' ? v : {}; const z = Math.min(3, Math.max(1, Number(v.zoom) || 1)); const x = Math.min(50, Math.max(-50, Number(v.x) || 0)); const y = Math.min(50, Math.max(-50, Number(v.y) || 0)); return `transform:translate(${x}%,${y}%) scale(${z});transform-origin:center center`; };

  /* ---------- potongan markup ---------- */
  const divider = () => '<div class="divider" aria-hidden="true"><span></span><i></i><span></span></div>';
  /* Ornamen bunga: ganti file assets/img/ornament-1.(svg|png) dan ornament-2.(svg|png).
   * k1 = pojok kiri atas, k2 = pojok kanan bawah. Ukuran & posisi: lihat .kamboja di style.css */
  const ORNAMENT = { k1: 'assets/img/ornament-1.svg', k2: 'assets/img/ornament-2.svg' };
  const flower = (cls) => `<img class="kamboja ${cls}" src="${ORNAMENT[cls]}" alt="" aria-hidden="true">`;
  const head = (eyebrow, title) =>
    `<header class="sec-head reveal">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2>${esc(title)}</h2>${divider()}</header>`;

  /* ---------- bagian-bagian halaman ---------- */
  function cover(d) {
    const c = d.cover || {};
    const bg = src(c.image);
    return `<section id="sec-cover" class="cover${state.opened ? ' opened gone' : ''}">
      ${bg ? `<img class="cover-bg" style="${imageTransform(c.imageView)}" src="${esc(bg)}" alt="">` : ''}
      ${flower('k1')}${flower('k2')}
      <div class="cover-inner">
        <p class="eyebrow">${esc(c.eyebrow)}</p>
        <h1 class="names">${esc(c.title)}</h1>
        <p class="cover-date">${esc(c.dateText)}</p>
        <div class="guest">
          <p>${esc(c.guestLabel)}</p>
          <h2 id="guestName">${esc(guest || c.defaultGuest || '')}</h2>
        </div>
        <button id="openBtn" class="btn" type="button">${esc(c.buttonText || 'Buka Undangan')}</button>
      </div>
    </section>`;
  }

  function opening(d) {
    const o = d.opening || {};
    if (!o.greeting && !o.text) return '';
    return `<section id="sec-opening" class="sec">${flower('k1')}${flower('k2')}
      <div class="wrap">
        <h2 class="greeting reveal">${esc(o.greeting)}</h2>${divider()}
        <p class="reveal">${br(o.text)}</p>
      </div></section>`;
  }

  function person(p) {
    p = p || {};
    const photo = src(p.photo);
    return `<article class="person reveal">
      ${photo ? `<div class="arch"><img style="${imageTransform(p.photoView)}" src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy"></div>` : ''}
      <h3 class="pname">${esc(p.name)}</h3>
      <p class="muted">${esc(p.childOf)}</p>
      <p class="parents">${esc(p.father)}<br><span class="amp">&amp;</span><br>${esc(p.mother)}</p>
      <p class="addr">${esc(p.address)}</p>
    </article>`;
  }

  function couple(d) {
    return `<section id="sec-couple" class="sec alt"><div class="wrap">${person(d.groom)}<div class="and reveal">&amp;</div>${person(d.bride)}</div></section>`;
  }

  function verse(d) {
    const v = d.verse || {};
    if (!v.text) return '';
    return `<section id="sec-verse" class="sec dark">${flower('k1')}${flower('k2')}<div class="wrap"><blockquote class="reveal">${br(v.text)}</blockquote></div></section>`;
  }

  function events(d) {
    const list = Array.isArray(d.events) ? d.events : [];
    const c = d.closing || {};
    const cards = list
      .map(
        (e) => `<div class="card reveal">
        ${e.title ? `<h3 class="card-title">${esc(e.title)}</h3>` : ''}
        <p class="label">${esc(e.day)}</p>
        <p class="big">${esc(e.dateText)}</p>
        <p class="label">Pukul</p>
        <p class="big">${esc(e.timeText)}</p>
        <p class="label">Bertempat di</p>
        <p class="strong">${esc(e.place)}</p>
        <p class="addr">${esc(e.address)}</p>
        ${e.mapUrl ? `<a class="btn small" href="${esc(link(e.mapUrl))}" target="_blank" rel="noopener">Map Lokasi Acara</a>` : ''}
      </div>`
      )
      .join('');
    return `<section id="sec-events" class="sec"><div class="wrap">
      ${cards}
      <div class="closing reveal">
        <p>${br(c.text)}</p>
        <p>${br(c.thanks)}</p>
        ${divider()}
        <h3 class="greeting">${esc(c.salam)}</h3>
        <p class="muted">${esc(c.familyIntro)}</p>
        <p class="strong">${br(c.familyNames)}</p>
      </div></div></section>`;
  }

  function countdown(d) {
    const c = d.countdown || {};
    if (!c.datetime) return '';
    return `<section id="sec-countdown" class="sec dark">${flower('k1')}${flower('k2')}<div class="wrap">
      ${head('', c.title || 'Hari Bahagia')}
      <div class="cd reveal" id="cd">
        <div><b data-u="d">0</b><span>Hari</span></div>
        <div><b data-u="h">0</b><span>Jam</span></div>
        <div><b data-u="m">0</b><span>Menit</span></div>
        <div><b data-u="s">0</b><span>Detik</span></div>
      </div></div></section>`;
  }

  function gallery(d) {
    const g = d.gallery || {};
    const photos = (Array.isArray(g.photos) ? g.photos : []).map((p) => (typeof p === 'string' ? { src: p } : p)).filter((p) => p && p.src);
    if (!photos.length) return '';
    return `<section id="sec-gallery" class="sec"><div class="wrap">
      ${head('', g.title || 'Galeri')}
      <div class="gallery reveal">${photos
        .map((p, i) => `<a href="${esc(src(p.src))}" data-lb="${i}" aria-label="Foto ${i + 1}"><img style="${imageTransform(p.view)}" src="${esc(src(p.src))}" alt="${esc(p.caption || 'Galeri ' + (i + 1))}" loading="lazy"></a>`)
        .join('')}</div></div></section>`;
  }

  function videoEmbed(u) {
    u = String(u || '').trim();
    if (!u) return '';
    const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    return `<div class="video"><video src="${esc(src(u))}" controls playsinline preload="metadata"></video></div>`;
  }

  function story(d) {
    const s = d.story || {};
    const items = Array.isArray(s.items) ? s.items : [];
    if (!s.videoUrl && !items.length && !s.intro) return '';
    return `<section id="sec-story" class="sec alt">${flower('k1')}${flower('k2')}<div class="wrap">
      ${head('', s.title || 'Cerita Kami')}
      ${s.intro ? `<p class="reveal">${br(s.intro)}</p>` : ''}
      <div class="reveal">${videoEmbed(s.videoUrl)}</div>
      ${items.length ? `<ol class="timeline">${items.map((it) => `<li class="reveal"><span class="t-date">${esc(it.date)}</span><h4>${esc(it.title)}</h4><p>${br(it.text)}</p></li>`).join('')}</ol>` : ''}
    </div></section>`;
  }

  function rsvp(d) {
    const r = d.rsvp || {};
    if (r.enabled === false) return '';
    return `<section id="sec-rsvp" class="sec">${flower('k1')}${flower('k2')}<div class="wrap">
      ${head('', r.title || 'Mohon Doa Restu')}
      <form id="rsvpForm" class="form reveal" autocomplete="off">
        <input name="guestName" type="text" placeholder="Masukkan namamu" maxlength="80" required value="${esc(guest)}">
        <textarea name="message" rows="4" placeholder="Berikan ucapanmu" maxlength="500" required></textarea>
        <select name="attendance" aria-label="Kehadiran" required>
          <option value="" disabled selected>Kamu akan hadir?</option>
          <option value="Hadir">Hadir</option>
          <option value="Tidak Hadir">Tidak Hadir</option>
          <option value="Masih Ragu">Masih Ragu</option>
        </select>
        <button class="btn" type="submit">Kirim Ucapan</button>
        <p id="rsvpStatus" class="status" role="status"></p>
      </form>
      <div id="wishList" class="wishes"></div>
    </div></section>`;
  }

  function gift(d) {
    const g = d.gift || {};
    const acc = Array.isArray(g.accounts) ? g.accounts : [];
    if (g.enabled === false || !acc.length) return '';
    return `<section id="sec-gift" class="sec dark">${flower('k1')}${flower('k2')}<div class="wrap">
      ${head('', g.title || 'Wedding Gift')}
      <p class="reveal">${br(g.text)}</p>
      ${acc
        .map(
          (a) => `<div class="card bank reveal">
          <h4>${esc(a.bank)}</h4>
          <p class="acc">${esc(a.number)}</p>
          <p>${esc(a.name)}</p>
          <button class="btn small" type="button" data-copy="${esc(a.number)}">Salin No Rekening</button>
        </div>`
        )
        .join('')}
    </div></section>`;
  }

  function footer(d) {
    const f = d.footer || {};
    const socials = (Array.isArray(f.socials) ? f.socials : []).filter((s) => s && s.url);
    return `<footer id="sec-footer" class="sec foot"><div class="wrap">
      <h2 class="greeting reveal">${esc(f.title || 'Matur Suksma')}</h2>${divider()}
      ${f.text ? `<p class="reveal">${br(f.text)}</p>` : ''}
      ${socials.length ? `<ul class="socials reveal">${socials.map((s) => `<li><a href="${esc(link(s.url))}" target="_blank" rel="noopener">${esc(s.label || s.url)}</a></li>`).join('')}</ul>` : ''}
      ${f.credit ? `<p class="credit">${esc(f.credit)}</p>` : ''}
    </div></footer>`;
  }

  /* ---------- tema ---------- */
  function applyTheme(t, meta) {
    const st = document.documentElement.style;
    const set = (k, v) => (v ? st.setProperty(k, v) : st.removeProperty(k));
    set('--primary', safeColor(t.primary));
    set('--accent', safeColor(t.accent));
    set('--bg', safeColor(t.bg));
    set('--text', safeColor(t.text));
    const hf = safeFont(t.headingFont), sf = safeFont(t.scriptFont), bf = safeFont(t.bodyFont);
    set('--f-head', hf && `'${hf}', serif`);
    set('--f-script', sf && `'${sf}', cursive`);
    set('--f-body', bf && `'${bf}', Georgia, serif`);
    document.title = meta.title || 'Undangan Pawiwahan';
    const md = $('meta[name="description"]');
    if (md && meta.description) md.setAttribute('content', meta.description);
    const ot = $('meta[property="og:title"]');
    if (ot && meta.title) ot.setAttribute('content', meta.title);
    const od = $('meta[property="og:description"]');
    if (od && meta.description) od.setAttribute('content', meta.description);
  }

  /* ---------- musik ---------- */
  function setupMusic(m) {
    const a = $('#bgm'), b = $('#musicBtn');
    m = m || {};
    const s = src(m.src);
    if (!s) {
      try { a.pause(); } catch (e) { /* abaikan */ }
      a.removeAttribute('src');
      b.hidden = true;
      b.classList.remove('playing');
      return;
    }
    if (a.getAttribute('src') !== s) {
      a.setAttribute('src', s);
      try { a.load(); } catch (e) { /* abaikan */ }
    }
    b.hidden = false;
    b.classList.toggle('playing', !a.paused);
  }
  function playMusic() {
    const a = $('#bgm');
    if (!a.getAttribute('src') || PREVIEW) return;
    const p = a.play();
    if (p && p.then) p.then(() => $('#musicBtn').classList.add('playing')).catch(() => {});
  }

  /* ---------- countdown ---------- */
  function startCountdown(c) {
    c = c || {};
    const box = $('#cd');
    if (!box || !c.datetime) return;
    const target = new Date(`${c.datetime}${c.tz || '+08:00'}`).getTime();
    if (isNaN(target)) return;
    const set = (u, v) => { const el = $(`[data-u="${u}"]`, box); if (el) el.textContent = String(v); };
    const tick = () => {
      const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      set('d', Math.floor(s / 86400));
      set('h', Math.floor((s % 86400) / 3600));
      set('m', Math.floor((s % 3600) / 60));
      set('s', s % 60);
    };
    tick();
    state.timers.push(setInterval(tick, 1000));
  }

  /* ---------- ucapan ---------- */
  function renderWishes() {
    const box = $('#wishList');
    if (!box) return;
    box.innerHTML = state.wishes
      .map((w) => `<div class="wish"><b>${esc(w.name)}</b>${w.attendance ? `<em>${esc(w.attendance)}</em>` : ''}<p>${br(w.message)}</p></div>`)
      .join('');
  }
  function loadWishes(r) {
    r = r || {};
    if (!r.listUrl || PREVIEW) return renderWishes();
    fetch(r.listUrl)
      .then((x) => x.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        const mine = state.wishes.filter((w) => w.local);
        state.wishes = mine.concat(list.map((w) => ({ name: w.name, message: w.message, attendance: w.attendance })));
        renderWishes();
      })
      .catch(() => renderWishes());
  }

  /* ---------- render utama ---------- */
  function clearTimers() { state.timers.forEach(clearInterval); state.timers = []; }

  function draw(d) {
    d = d || {};
    state.data = d;
    clearTimers();
    applyTheme(d.theme || {}, d.meta || {});
    $('#app').innerHTML =
      cover(d) +
      '<main id="main">' +
      [opening, couple, verse, events, countdown, gallery, story, rsvp, gift, footer].map((fn) => fn(d)).join('') +
      '</main>';
    const sectionColors = d.sectionColors || {};
    Object.entries(sectionColors).forEach(([id, color]) => {
      const el = document.getElementById(id);
      if (el && /^#[0-9a-f]{3,8}$/i.test(String(color || '').trim())) el.style.backgroundColor = color.trim();
    });
    document.body.classList.toggle('locked', !state.opened && !PREVIEW);

    const items = $$('.reveal');
    if (state.io) state.io.disconnect();
    if (PREVIEW || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
    } else {
      state.io = new IntersectionObserver(
        (en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); state.io.unobserve(x.target); } }),
        { threshold: 0.12 }
      );
      items.forEach((el) => state.io.observe(el));
    }

    startCountdown(d.countdown);
    setupMusic(d.music);
    loadWishes(d.rsvp);
  }

  /* ---------- interaksi (delegasi, dipasang sekali) ---------- */
  function openInvitation() {
    state.opened = true;
    const c = $('#sec-cover');
    if (c) {
      c.classList.add('opened');
      setTimeout(() => c.classList.add('gone'), 1200);
    }
    document.body.classList.remove('locked');
    window.scrollTo(0, 0);
    playMusic();
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { /* abaikan */ }
      ta.remove();
      return ok;
    }
  }

  function showLightbox(i) {
    const lb = $('#lightbox');
    const n = state.lb.list.length;
    if (!n) return;
    state.lb.i = (i + n) % n;
    $('img', lb).src = state.lb.list[state.lb.i];
    lb.hidden = false;
  }

  document.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('#openBtn')) return openInvitation();

    const mb = t.closest('#musicBtn');
    if (mb) {
      const a = $('#bgm');
      if (a.paused) { a.play().then(() => mb.classList.add('playing')).catch(() => {}); }
      else { a.pause(); mb.classList.remove('playing'); }
      return;
    }

    const cp = t.closest('[data-copy]');
    if (cp) {
      const ok = await copyText(cp.getAttribute('data-copy'));
      const old = cp.textContent;
      cp.textContent = ok ? 'Tersalin ✓' : 'Gagal menyalin';
      setTimeout(() => (cp.textContent = old), 1800);
      return;
    }

    const lbLink = t.closest('[data-lb]');
    if (lbLink) {
      e.preventDefault();
      state.lb.list = $$('[data-lb]').map((a) => a.getAttribute('href'));
      return showLightbox(Number(lbLink.getAttribute('data-lb')));
    }
    if (t.closest('.lb-close') || t.id === 'lightbox') { $('#lightbox').hidden = true; return; }
    if (t.closest('.lb-prev')) return showLightbox(state.lb.i - 1);
    if (t.closest('.lb-next')) return showLightbox(state.lb.i + 1);
  });

  document.addEventListener('keydown', (e) => {
    const lb = $('#lightbox');
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true;
    if (e.key === 'ArrowLeft') showLightbox(state.lb.i - 1);
    if (e.key === 'ArrowRight') showLightbox(state.lb.i + 1);
  });

  document.addEventListener('submit', async (e) => {
    const f = e.target.closest ? e.target.closest('#rsvpForm') : null;
    if (!f) return;
    e.preventDefault();
    const r = (state.data && state.data.rsvp) || {};
    const status = $('#rsvpStatus');
    const payload = {
      name: f.elements.guestName.value.trim(),
      attendance: f.elements.attendance.value,
      message: f.elements.message.value.trim(),
      date: new Date().toISOString()
    };
    if (PREVIEW) { status.textContent = 'Mode pratinjau: pesan tidak dikirim.'; return; }
    const btn = $('button[type="submit"]', f);
    btn.disabled = true;
    try {
      if (r.mode === 'endpoint' && r.endpoint) {
        await fetch(r.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        status.textContent = 'Terima kasih, ucapan Anda telah terkirim.';
      } else {
        let num = String(r.whatsapp || '').replace(/\D/g, '');
        if (num.startsWith('0')) num = '62' + num.slice(1);
        if (!num) throw new Error('Nomor WhatsApp belum diatur.');
        const text = `Om Swastyastu,\nSaya ${payload.name} (${payload.attendance}).\n\n${payload.message}`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        status.textContent = 'Silakan kirim pesan melalui WhatsApp yang terbuka.';
      }
      state.wishes.unshift({ name: payload.name, message: payload.message, attendance: payload.attendance, local: true });
      renderWishes();
      f.elements.message.value = '';
    } catch (err) {
      status.textContent = 'Gagal mengirim: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- pratinjau dari editor ---------- */
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!PREVIEW || !m || typeof m !== 'object') return;
    if (m.type === 'preview') {
      if (m.files) {
        Object.keys(m.files).forEach((p) => {
          if (!(m.files[p] instanceof Blob)) return;
          if (blobs.has(p)) URL.revokeObjectURL(blobs.get(p));
          blobs.set(p, URL.createObjectURL(m.files[p]));
        });
      }
      if (typeof m.showCover === 'boolean') state.opened = !m.showCover;
      draw(m.data);
    } else if (m.type === 'scroll') {
      const el = document.getElementById(m.id);
      if (el && m.id !== 'sec-cover') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  /* ---------- mulai ---------- */
  async function init() {
    if (PREVIEW) {
      window.parent.postMessage({ type: 'ready' }, '*');
      return; // data datang dari editor
    }
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      draw(await res.json());
    } catch (err) {
      $('#app').innerHTML = '<p style="padding:2rem;text-align:center">Gagal memuat data undangan.</p>';
      document.body.classList.remove('locked');
      console.error(err);
    }
  }
  init();
})();
