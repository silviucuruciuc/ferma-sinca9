// Planul interactiv: zoom, deplasare, selecție, filtre, aranjare și salvare în GitHub.
// Planul e randat pe server (funcționează și fără JS); aici doar îl „însuflețim”.

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const normalizeaza = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmt = (v) => Number(v).toLocaleString('ro-RO', { maximumFractionDigits: 1 });
const reducereMiscare = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CHEIE_LOCAL = 'ferma.pozitii.nesalvate';
const CHEIE_TOKEN = 'ferma.github-token';

const svg = $('#plan');
const cutie = $('#harta-plan');
const sursa = $('#date-plan');
if (svg && cutie && sursa) porneste(JSON.parse(sursa.textContent));

function porneste(DATE) {
  const maxY = DATE.limite.maxY;
  const pomi = new Map(DATE.pomi.map((p) => [p.id, p]));
  const original = new Map(DATE.pomi.map((p) => [p.id, p.x == null ? null : { x: p.x, y: p.y }]));
  const modificari = new Map();
  const scalabile = svg.getElementsByClassName('s');
  const stratPomi = $('.strat-pomi', svg);
  const stratCoroane = $('.strat-coroane', svg);

  let selectat = null;
  let aranjare = false;
  let alegere = null;
  let arataIstoric = false;
  let cautare = '';
  const oprite = new Set();

  // ---------------------------------------------------------------- vizualizare
  const vbServer = svg.viewBox.baseVal;
  const tot = { x: vbServer.x, y: vbServer.y, w: vbServer.width, h: vbServer.height };
  let vb = { ...tot };
  let k = 0;

  const laSvg = (x, y) => [x, Math.round((maxY - y) * 1000) / 1000];
  const dinSvg = (sx, sy) => [sx, maxY - sy];

  function punct(ev) {
    const r = svg.getBoundingClientRect();
    return [vb.x + ((ev.clientX - r.left) * vb.w) / r.width, vb.y + ((ev.clientY - r.top) * vb.h) / r.height];
  }

  function aplica() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const cw = svg.clientWidth || 1;
    const kNou = vb.w / cw;
    if (Math.abs(kNou - k) > k * 0.0005) {
      k = kNou;
      const t = `scale(${k.toFixed(5)})`;
      for (const el of scalabile) el.setAttribute('transform', t);
    }
    svg.classList.toggle('zoom-apropiat', 1 / k > 20);
    // Scara grafică: o lungime „rotundă” de ~70–140 px.
    const pasi = [0.5, 1, 2, 5, 10, 20, 50, 100];
    const L = pasi.find((p) => p / k >= 70) ?? 100;
    $('.scara-bara').style.width = `${Math.round(L / k)}px`;
    $('.scara-text').textContent = `${fmt(L)} m`;
  }

  function potriveste(r = tot) {
    const cw = svg.clientWidth;
    const ch = svg.clientHeight;
    if (!cw || !ch) return;
    const ar = ch / cw;
    let w = r.w;
    let h = r.h;
    if (h / w > ar) w = h / ar;
    else h = w * ar;
    vb = { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
    aplica();
  }

  const MIN_W = 5;
  const maxW = () => tot.w * 2.5;

  function zoomLa(cx, cy, factor) {
    const r = svg.getBoundingClientRect();
    const px = vb.x + ((cx - r.left) * vb.w) / r.width;
    const py = vb.y + ((cy - r.top) * vb.h) / r.height;
    const w = Math.min(maxW(), Math.max(MIN_W, vb.w * factor));
    const f = w / vb.w;
    vb = { x: px - (px - vb.x) * f, y: py - (py - vb.y) * f, w, h: vb.h * f };
    aplica();
  }

  function anima(tinta) {
    if (reducereMiscare) {
      vb = tinta;
      return aplica();
    }
    const start = { ...vb };
    const t0 = performance.now();
    const pas = (t) => {
      const u = Math.min(1, (t - t0) / 320);
      const e = 1 - Math.pow(1 - u, 3);
      vb = {
        x: start.x + (tinta.x - start.x) * e,
        y: start.y + (tinta.y - start.y) * e,
        w: start.w + (tinta.w - start.w) * e,
        h: start.h + (tinta.h - start.h) * e,
      };
      aplica();
      if (u < 1) requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  }

  function centreazaPe(id) {
    const poz = pozitie(id);
    if (!poz) return;
    const [sx, sy] = laSvg(poz.x, poz.y);
    const w = Math.min(vb.w, 26);
    const h = w * (vb.h / vb.w);
    anima({ x: sx - w / 2, y: sy - h / 2, w, h });
  }

  new ResizeObserver(() => {
    const cw = svg.clientWidth;
    const ch = svg.clientHeight;
    if (!cw || !ch) return;
    if (!k) return potriveste();
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    vb.h = vb.w * (ch / cw);
    vb.x = cx - vb.w / 2;
    vb.y = cy - vb.h / 2;
    aplica();
  }).observe(svg);

  // ---------------------------------------------------------------- gesturi
  const pointeri = new Map();
  let gest = null;

  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);
    pointeri.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeri.size === 2) {
      const [a, b] = [...pointeri.values()];
      const mid = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 };
      gest = { tip: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), vb0: { ...vb }, c0: punct(mid) };
      return;
    }
    const marcaj = e.target.closest('.pom');
    if (aranjare && marcaj && pomi.get(marcaj.dataset.id)?.spalier) {
      // Pomii palisați își iau locul din spalier — se mută mutând capătul spalierului.
      gest = { tip: 'pan', x0: e.clientX, y0: e.clientY, vb0: { ...vb }, pe: marcaj.dataset.id, mutat: false };
    } else if (aranjare && marcaj) {
      gest = { tip: 'trage', id: marcaj.dataset.id, x0: e.clientX, y0: e.clientY, mutat: false };
    } else {
      gest = { tip: 'pan', x0: e.clientX, y0: e.clientY, vb0: { ...vb }, pe: marcaj?.dataset.id ?? null, mutat: false };
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!pointeri.has(e.pointerId) || !gest) return;
    pointeri.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();

    if (gest.tip === 'pinch' && pointeri.size === 2) {
      const [a, b] = [...pointeri.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const w = Math.min(maxW(), Math.max(MIN_W, (gest.vb0.w * gest.d0) / d));
      const h = w * (r.height / r.width);
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;
      vb = { x: gest.c0[0] - (mx * w) / r.width, y: gest.c0[1] - (my * h) / r.height, w, h };
      return aplica();
    }

    const dx = e.clientX - gest.x0;
    const dy = e.clientY - gest.y0;
    if (!gest.mutat && Math.hypot(dx, dy) > 4) gest.mutat = true;
    if (!gest.mutat) return;

    if (gest.tip === 'pan') {
      vb.x = gest.vb0.x - (dx * gest.vb0.w) / r.width;
      vb.y = gest.vb0.y - (dy * gest.vb0.h) / r.height;
      aplica();
    } else if (gest.tip === 'trage') {
      const [x, y] = aliniaza(...dinSvg(...punct(e)));
      gest.poz = { x, y };
      mutaMarcaj(gest.id, gest.poz);
      afiseazaVecin(gest.id, x, y);
    }
  });

  const termina = (e) => {
    if (!pointeri.has(e.pointerId)) return;
    pointeri.delete(e.pointerId);
    if (!gest) return;

    if (gest.tip === 'pinch') {
      if (pointeri.size === 1) {
        const [rest] = [...pointeri.values()];
        gest = { tip: 'pan', x0: rest.x, y0: rest.y, vb0: { ...vb }, pe: null, mutat: true };
      } else gest = null;
      return;
    }
    if (e.type === 'pointercancel') {
      if (gest.tip === 'trage') deseneaza(gest.id);
      gest = null;
      return;
    }

    if (gest.tip === 'trage') {
      if (gest.mutat && gest.poz) seteazaPozitie(gest.id, gest.poz);
      selecteaza(gest.id);
    } else if (gest.tip === 'pan' && !gest.mutat) {
      if (masurare) {
        // Dacă atingi un pom aflat pe plan, punctul se prinde exact de el.
        const pePom = gest.pe ? pozitie(gest.pe) : null;
        const [x, y] = pePom ? [pePom.x, pePom.y] : dinSvg(...punct(e));
        puncteMasura.push([round2(x), round2(y), gest.pe && pePom ? pomi.get(gest.pe).eticheta : null]);
        randeazaMasura();
      } else if (gest.pe) selecteaza(gest.pe);
      else if (aranjare && alegere) {
        const [x, y] = aliniaza(...dinSvg(...punct(e)));
        const id = alegere;
        alegeDinTava(null);
        seteazaPozitie(id, { x, y });
        selecteaza(id);
        afiseazaVecin(id, x, y);
      } else deselecteaza();
    }
    gest = null;
  };
  svg.addEventListener('pointerup', termina);
  svg.addEventListener('pointercancel', termina);

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 18 : 1;
      zoomLa(e.clientX, e.clientY, Math.exp(e.deltaY * unit * 0.0016));
    },
    { passive: false },
  );

  // Marcajele sunt linkuri (pentru varianta fără JS). Cu JS: clic = selecție;
  // Enter pe un pom deja selectat deschide fișa.
  svg.addEventListener('click', (e) => {
    const m = e.target.closest('.pom');
    if (!m) return;
    e.preventDefault();
    if (e.detail === 0) {
      if (selectat === m.dataset.id) location.href = m.getAttribute('href');
      else selecteaza(m.dataset.id);
    }
  });

  $$('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => {
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (b.dataset.zoom === 'in') zoomLa(cx, cy, 0.7);
      else if (b.dataset.zoom === 'out') zoomLa(cx, cy, 1 / 0.7);
      else potriveste();
    }),
  );

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (masurare && puncteMasura.length) {
      puncteMasura.pop();
      randeazaMasura();
    } else if (masurare) comutaMasurare(false);
    else if (alegere) alegeDinTava(null);
    else deselecteaza();
  });

  // ---------------------------------------------------------------- poziții și marcaje
  const marcaj = (id) => svg.querySelector(`.pom[data-id="${CSS.escape(id)}"]`);
  const cerc = (id) => svg.querySelector(`.coroana[data-id="${CSS.escape(id)}"]`);
  const pozitie = (id) => (modificari.has(id) ? modificari.get(id) : original.get(id));
  const round2 = (v) => Math.round(v * 100) / 100;

  function aliniaza(x, y) {
    if ($('#aliniere')?.checked) return [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
    return [round2(x), round2(y)];
  }

  function el(tag, atribute = {}, copii = []) {
    const n = document.createElementNS(NS, tag);
    for (const [a, v] of Object.entries(atribute)) n.setAttribute(a, v);
    copii.forEach((c) => n.append(c));
    return n;
  }

  function creeazaMarcaj(p) {
    const t = `scale(${k.toFixed(5)})`;
    const forma =
      p.forma === 'patrat'
        ? el('rect', { class: 'forma', x: -5.5, y: -5.5, width: 11, height: 11, rx: 2 })
        : p.forma === 'romb'
          ? el('rect', { class: 'forma', x: -5, y: -5, width: 10, height: 10, rx: 1, transform: 'rotate(45)' })
          : el('circle', { class: 'forma', r: 6.5 });
    const text = el('text', { y: -12, 'text-anchor': 'middle' });
    text.textContent = p.id;
    const a = el('a', {
      href: p.url,
      class: 'pom',
      'data-id': p.id,
      'data-specie': p.specie,
      'data-grupa': p.grupa,
      'data-stare': p.stare,
      style: `--c:${p.culoare}`,
      'aria-label': `${p.eticheta}: ${p.soi}${p.portaltoi ? ' / ' + p.portaltoi : ''}`,
    }, [el('g', { class: 's simbol', transform: t }, [el('circle', { class: 'inel', r: 11 }), forma]), el('g', { class: 's eticheta-pom', transform: t }, [text])]);
    stratPomi.append(a);
    stratCoroane.append(el('circle', { class: 'coroana', 'data-id': p.id, r: (p.coroana / 2).toFixed(2), style: `--c:${p.culoare}` }));
    return a;
  }

  function mutaMarcaj(id, poz) {
    const m = marcaj(id) ?? creeazaMarcaj(pomi.get(id));
    const [sx, sy] = laSvg(poz.x, poz.y);
    m.setAttribute('transform', `translate(${sx} ${sy})`);
    const c = cerc(id);
    c?.setAttribute('cx', sx);
    c?.setAttribute('cy', sy);
  }

  function deseneaza(id) {
    const poz = pozitie(id);
    if (!poz) {
      marcaj(id)?.remove();
      cerc(id)?.remove();
    } else mutaMarcaj(id, poz);
  }

  function seteazaPozitie(id, poz) {
    const o = original.get(id);
    const egal = (!o && !poz) || (o && poz && o.x === poz.x && o.y === poz.y);
    if (egal) modificari.delete(id);
    else modificari.set(id, poz);
    deseneaza(id);
    persistaLocal();
    randeazaTava();
    stare();
  }

  function afiseazaVecin(id, x, y) {
    const p = pomi.get(id);
    let cel = null;
    for (const q of pomi.values()) {
      if (q.id === id || q.istoric) continue;
      const pq = pozitie(q.id);
      if (!pq) continue;
      const d = Math.hypot(pq.x - x, pq.y - y);
      if (!cel || d < cel.d) cel = { q, d };
    }
    let text = `${p.eticheta}: x ${fmt(x)} · y ${fmt(y)} m`;
    let avert = false;
    if (cel) {
      const recomandat = (p.coroana + cel.q.coroana) / 2;
      avert = cel.d < recomandat * 0.9;
      text += ` · cel mai aproape: ${cel.q.id}, la ${fmt(cel.d)} m`;
      if (avert) text += ` (coroanele se vor atinge; recomandat ≥ ${fmt(recomandat)} m)`;
    }
    info(text, avert);
  }

  function info(text, avert = false) {
    const n = $('#mod-info');
    n.textContent = text;
    n.classList.toggle('avertizare', avert);
  }

  // ---------------------------------------------------------------- selecție
  function selecteaza(id, { centreaza = false } = {}) {
    const p = pomi.get(id);
    if (!p) return;
    selectat = id;
    $$('.pom.selectat', svg).forEach((m) => m.classList.remove('selectat'));
    const m = marcaj(id);
    if (m) {
      m.classList.add('selectat');
      m.parentNode.append(m);
    }

    $('#sel-tag').style.setProperty('--c', p.culoare);
    $('#sel-id').textContent = p.eticheta;
    const soi = $('#sel-soi');
    soi.textContent = p.soi;
    if (p.portaltoi) {
      const s = document.createElement('span');
      s.className = 'pt';
      s.textContent = ` / ${p.portaltoi}`;
      soi.append(s);
    }

    const st = $('#sel-stare');
    st.replaceChildren();
    const ins = document.createElement('span');
    ins.className = 'insigna';
    ins.dataset.stare = p.stare;
    ins.textContent = p.stareNume;
    st.append(ins);
    const detalii = [];
    if (p.plantat) detalii.push(`plantat ${p.plantat}`);
    else if (p.comanda) detalii.push(`comandă: ${p.comanda}`);
    const poz = pozitie(id);
    detalii.push(poz ? `x ${fmt(poz.x)} · y ${fmt(poz.y)} m` : 'nu e încă pe plan');
    if (p.spalier) detalii.push(`palisat pe „${p.spalier}”`);
    st.append(document.createTextNode(detalii.join(' · ')));

    const lista = $('#sel-jurnal');
    lista.replaceChildren(
      ...p.ultimele.map((j) => {
        const li = document.createElement('li');
        const c = document.createElement('span');
        c.className = 'cand';
        c.textContent = j.data;
        li.append(c, `${j.tip}: ${j.titlu}`);
        return li;
      }),
    );
    lista.hidden = !p.ultimele.length;

    $('#sel-fisa').href = p.url;
    $('#sel-jurnal-nou').href = p.jurnalNou;
    $('#sel-scoate').hidden = !(aranjare && poz) || !!p.spalier;
    $('#selectie').hidden = false;
    const panou = $('.panou');
    if (panou && matchMedia('(min-width: 58rem)').matches) panou.scrollTo({ top: 0, behavior: reducereMiscare ? 'auto' : 'smooth' });
    $$('.tava-pom').forEach((b) => b.classList.toggle('curent', b.dataset.id === id));
    history.replaceState(null, '', `#${id}`);
    if (centreaza) centreazaPe(id);
  }

  function deselecteaza() {
    selectat = null;
    $$('.pom.selectat', svg).forEach((m) => m.classList.remove('selectat'));
    $('#selectie').hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname);
  }

  $('#inchide-selectie').addEventListener('click', deselecteaza);
  $('#sel-scoate').addEventListener('click', () => {
    if (!selectat) return;
    const id = selectat;
    seteazaPozitie(id, null);
    selecteaza(id);
    info(`${pomi.get(id).eticheta} a fost scos de pe plan (se poate reașeza din listă).`);
  });

  // ---------------------------------------------------------------- filtre, căutare
  const textPom = (p) => normalizeaza([p.id, p.eticheta, p.soi, p.portaltoi, p.specieNume].join(' '));

  function aplicaFiltre() {
    const q = normalizeaza(cautare).trim();
    for (const p of pomi.values()) {
      const vizibil = !oprite.has(p.specie) && (arataIstoric || !p.istoric);
      const potrivit = !q || textPom(p).includes(q);
      const m = marcaj(p.id);
      m?.classList.toggle('ascuns', !vizibil);
      m?.classList.toggle('estompat', vizibil && !potrivit);
      cerc(p.id)?.classList.toggle('ascuns', !vizibil);
      $(`.tava-pom[data-id="${CSS.escape(p.id)}"]`)?.classList.toggle('ascuns', !(vizibil && potrivit));
    }
  }

  $$('.filtru').forEach((b) =>
    b.addEventListener('click', () => {
      const s = b.dataset.specie;
      const activ = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!activ));
      if (activ) oprite.add(s);
      else oprite.delete(s);
      aplicaFiltre();
    }),
  );

  $('#cautare').addEventListener('input', (e) => {
    cautare = e.target.value;
    aplicaFiltre();
  });
  $('#cautare').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = normalizeaza(cautare).trim();
    const gasit = [...pomi.values()].find((p) => textPom(p).includes(q) && !oprite.has(p.specie));
    if (gasit) selecteaza(gasit.id, { centreaza: true });
  });

  $('#arata-coroane').addEventListener('change', (e) => svg.classList.toggle('fara-coroane', !e.target.checked));
  $('#arata-istoric').addEventListener('change', (e) => {
    arataIstoric = e.target.checked;
    randeazaTava();
  });

  // ---------------------------------------------------------------- măsurare
  let masurare = false;
  const puncteMasura = [];
  const stratMasura = $('.strat-masura', svg);

  function comutaMasurare(activ = !masurare) {
    masurare = activ;
    if (masurare && aranjare) comutaAranjare(false);
    if (masurare) deselecteaza();
    cutie.classList.toggle('mod-masurare', masurare);
    $('#plan-masura').hidden = !masurare;
    $('#btn-masoara').textContent = masurare ? 'Ieși din măsurare' : 'Măsoară distanțe';
    if (!masurare) puncteMasura.length = 0;
    randeazaMasura();
  }

  function randeazaMasura() {
    stratMasura.replaceChildren();
    if (!masurare) return;
    const t = `scale(${k.toFixed(5)})`;
    const sp = puncteMasura.map(([x, y]) => laSvg(x, y));

    if (sp.length > 1) stratMasura.append(el('polyline', { class: 'masura-linie', points: sp.map((q) => q.join(',')).join(' ') }));

    let total = 0;
    for (let i = 1; i < puncteMasura.length; i++) {
      const [x1, y1] = puncteMasura[i - 1];
      const [x2, y2] = puncteMasura[i];
      const d = Math.hypot(x2 - x1, y2 - y1);
      total += d;
      const [mx, my] = laSvg((x1 + x2) / 2, (y1 + y2) / 2);
      const txt = el('text', { 'text-anchor': 'middle', y: -6 });
      txt.textContent = `${fmt(d)} m`;
      stratMasura.append(el('g', { class: 'masura-et', transform: `translate(${mx} ${my})` }, [el('g', { class: 's', transform: t }, [txt])]));
    }

    for (const [sx, sy] of sp) {
      stratMasura.append(el('g', { class: 'masura-pct', transform: `translate(${sx} ${sy})` }, [el('g', { class: 's', transform: t }, [el('circle', { r: 4 })])]));
    }

    const n = puncteMasura.length;
    const capete = puncteMasura.filter((q) => q[2]).map((q) => q[2]);
    $('#masura-total').textContent =
      n === 0
        ? 'Atinge planul ca să pui primul punct.'
        : n === 1
          ? 'Un punct pus. Atinge încă unul.'
          : `${fmt(total)} m` +
            (n > 2 ? ` pe ${n - 1} segmente` : '') +
            (capete.length ? ` · ${capete.join(' → ')}` : '');
  }

  $('#btn-masoara').addEventListener('click', () => comutaMasurare());
  $('#btn-masura-iesi').addEventListener('click', () => comutaMasurare(false));
  $('#btn-masura-sterge').addEventListener('click', () => {
    puncteMasura.length = 0;
    randeazaMasura();
  });

  // ---------------------------------------------------------------- tava „Nepoziționați”
  function randeazaTava() {
    const lista = [...pomi.values()].filter((p) => !pozitie(p.id) && (arataIstoric || !p.istoric));
    $('#tava').replaceChildren(
      ...lista.map((p) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tava-pom';
        b.dataset.id = p.id;
        b.setAttribute('aria-pressed', String(alegere === p.id));
        const punct = document.createElement('span');
        punct.className = 'punct-specie';
        punct.dataset.forma = p.forma;
        punct.style.setProperty('--c', p.culoare);
        const idEl = document.createElement('span');
        idEl.className = 'id';
        idEl.textContent = p.eticheta;
        const soi = document.createElement('span');
        soi.className = 'soi';
        soi.textContent = p.portaltoi ? `${p.soi} / ${p.portaltoi}` : p.soi;
        b.append(punct, idEl, soi);
        li.append(b);
        return li;
      }),
    );
    $('#nr-tava').textContent = `(${lista.length})`;
    $('#bloc-tava').hidden = lista.length === 0 && !aranjare;
    $('#nota-tava').textContent = aranjare
      ? 'Alege un pom din listă, apoi atinge pe plan locul unde e (sau va fi) plantat.'
      : 'Pomi care nu au încă loc pe plan.';
    aplicaFiltre();
  }

  $('#tava').addEventListener('click', (e) => {
    const b = e.target.closest('.tava-pom');
    if (!b) return;
    if (aranjare) alegeDinTava(alegere === b.dataset.id ? null : b.dataset.id);
    else selecteaza(b.dataset.id);
  });

  function alegeDinTava(id) {
    alegere = id;
    cutie.classList.toggle('alege-loc', !!id);
    $$('.tava-pom').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    if (id) info(`Atinge planul unde e ${pomi.get(id).eticheta} (${pomi.get(id).soi}).`);
  }

  // ---------------------------------------------------------------- mod aranjare
  function stare() {
    const n = modificari.size;
    const btn = $('#btn-salveaza');
    btn.disabled = n === 0;
    btn.textContent = n ? `Salvează (${n})` : 'Salvează';
    $('#btn-renunta').textContent = n ? 'Închide (păstrez local)' : 'Închide';
    const pePlan = [...pomi.values()].filter((p) => !p.istoric && pozitie(p.id)).length;
    $('#nr-pe-plan').textContent = pePlan;
    const gol = $('#plan-gol');
    if (gol) gol.hidden = pePlan > 0 || aranjare;
  }

  function comutaAranjare(activ = !aranjare) {
    aranjare = activ;
    if (aranjare && masurare) comutaMasurare(false);
    cutie.classList.toggle('mod-aranjare', aranjare);
    $('#plan-mod').hidden = !aranjare;
    $('#btn-aranjeaza').textContent = aranjare ? 'Ieși din aranjare' : 'Aranjează pe plan';
    if (!aranjare) alegeDinTava(null);
    if (selectat) selecteaza(selectat);
    info(modificari.size ? `${modificari.size} modificări nesalvate.` : '');
    randeazaTava();
    stare();
  }

  $('#btn-aranjeaza').addEventListener('click', () => comutaAranjare());
  $('#btn-renunta').addEventListener('click', () => comutaAranjare(false));

  function persistaLocal() {
    try {
      if (modificari.size) localStorage.setItem(CHEIE_LOCAL, JSON.stringify([...modificari]));
      else localStorage.removeItem(CHEIE_LOCAL);
    } catch {}
  }

  function continutFinal(baza) {
    const m = new Map((baza.pozitii ?? []).map((p) => [p.pom, p]));
    for (const [id, poz] of modificari) {
      if (poz) m.set(id, { pom: id, x: poz.x, y: poz.y });
      else m.delete(id);
    }
    const pozitii = [...m.values()].sort((a, b) => a.pom.localeCompare(b.pom, 'ro', { numeric: true }));
    return JSON.stringify({ pozitii }, null, 2) + '\n';
  }

  $('#btn-descarca').addEventListener('click', () => {
    const baza = { pozitii: [...original].filter(([, p]) => p).map(([pom, p]) => ({ pom, x: p.x, y: p.y })) };
    const blob = new Blob([continutFinal(baza)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pozitii.json';
    a.click();
    URL.revokeObjectURL(a.href);
    info('Pune fișierul descărcat în src/data/pozitii.json și fă commit.');
  });

  // ---------------------------------------------------------------- salvare în GitHub
  const b64 = (s) => {
    let bin = '';
    new TextEncoder().encode(s).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  };
  const din64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  function tokenSalvat() {
    try {
      const u = JSON.parse(localStorage.getItem('sveltia-cms.user') || 'null');
      if (u?.token && (!u.backendName || u.backendName === 'github')) return u.token;
    } catch {}
    return localStorage.getItem(CHEIE_TOKEN);
  }

  function cereToken() {
    const dlg = $('#dialog-token');
    const input = $('#token-input');
    input.value = '';
    dlg.showModal();
    return new Promise((res) =>
      dlg.addEventListener(
        'close',
        () => {
          const t = input.value.trim();
          if (dlg.returnValue === 'ok' && t) {
            localStorage.setItem(CHEIE_TOKEN, t);
            res(t);
          } else res(null);
        },
        { once: true },
      ),
    );
  }

  async function salveaza(reincercare = false) {
    if (!DATE.github) {
      info('Repo-ul nu e configurat încă (github.owner în ferma.config.json). Folosește „Descarcă JSON”.', true);
      return;
    }
    const token = tokenSalvat() || (await cereToken());
    if (!token) return;
    const btn = $('#btn-salveaza');
    btn.disabled = true;
    info('Se salvează în GitHub…');
    const { owner, repo, branch } = DATE.github;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/src/data/pozitii.json`;
    const antet = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    try {
      const r = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: antet, cache: 'no-store' });
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error('auth'), { auth: true });
      let sha;
      let baza = { pozitii: [] };
      if (r.ok) {
        const j = await r.json();
        sha = j.sha;
        baza = JSON.parse(din64(j.content));
      } else if (r.status !== 404) throw new Error(`GitHub a răspuns ${r.status} la citire.`);

      const n = modificari.size;
      const put = await fetch(url, {
        method: 'PUT',
        headers: { ...antet, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Plan: ${n} ${n === 1 ? 'poziție actualizată' : 'poziții actualizate'}`,
          content: b64(continutFinal(baza)),
          branch,
          ...(sha ? { sha } : {}),
        }),
      });
      if (put.status === 401 || put.status === 403) throw Object.assign(new Error('auth'), { auth: true });
      if (put.status === 409 && !reincercare) return salveaza(true);
      if (!put.ok) throw new Error(`GitHub a răspuns ${put.status} la salvare.`);

      for (const [id, poz] of modificari) original.set(id, poz);
      modificari.clear();
      persistaLocal();
      info('Salvat în GitHub. Site-ul se reconstruiește singur în 1–2 minute.');
    } catch (err) {
      if (err.auth) {
        localStorage.removeItem(CHEIE_TOKEN);
        info('GitHub a refuzat accesul. Autentifică-te în Admin sau folosește un token cu drept de scriere pe acest repo.', true);
      } else info(`${err.message} Modificările sunt păstrate local.`, true);
    } finally {
      stare();
    }
  }

  $('#btn-salveaza').addEventListener('click', () => salveaza());

  // ---------------------------------------------------------------- pornire
  try {
    const salvate = JSON.parse(localStorage.getItem(CHEIE_LOCAL) || '[]');
    for (const [id, poz] of salvate) if (pomi.has(id)) modificari.set(id, poz);
  } catch {}
  for (const id of modificari.keys()) deseneaza(id);

  requestAnimationFrame(() => {
    potriveste();
    randeazaTava();
    stare();
    if (modificari.size) {
      comutaAranjare(true);
      info(`Ai ${modificari.size} modificări nesalvate din sesiunea trecută.`);
    }
    const id = decodeURIComponent(location.hash.slice(1));
    if (pomi.has(id)) selecteaza(id, { centreaza: true });
  });
}
