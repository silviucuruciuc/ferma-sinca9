// Geometria planului. Sistemul intern: metri, x spre EST, y spre NORD.
//
// În src/data/teren.yaml conturul poate fi dat:
//  - „local”: metri față de un colț ales de tine (implicit: colțul de sud-vest);
//  - „stereo70”: exact punctele din planul cadastral (X = Nord, Y = Est).
//    Stereo 70 e deja în metri, deci conversia e o simplă translație față de `origine_stereo70`.
// Pozițiile pomilor (src/data/pozitii.json) sunt mereu în metri locali.

/** „x y” pe linie (sau „x,y; x,y”). Acceptă și virgula zecimală („464512,33 513201,10”). */
export function parsePuncte(text) {
  if (Array.isArray(text)) return text.map((p) => [Number(p[0]), Number(p[1])]);
  return String(text ?? '')
    .split(/[;\n]+/)
    .map((linie) => linie.trim())
    .filter(Boolean)
    .map((linie) => {
      const parti = /\s/.test(linie) ? linie.split(/\s+/) : linie.split(',');
      const [a, b] = parti.map((t) => Number(t.replace(',', '.')));
      return [a, b];
    })
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

export function normalizeazaTeren(brut = {}) {
  const sistem = brut.sistem === 'stereo70' ? 'stereo70' : 'local';
  const toate = [];
  const colecteaza = (lista) => (lista ?? []).forEach((el) => toate.push(...parsePuncte(el.puncte)));
  colecteaza(brut.parcele);
  colecteaza(brut.zone);

  let conv = (p) => p;
  if (sistem === 'stereo70') {
    // Stereo 70: primul număr = X (Nord), al doilea = Y (Est).
    const o = brut.origine_stereo70 ?? {};
    const X0 = Number(o.x) || Math.min(...toate.map((p) => p[0]));
    const Y0 = Number(o.y) || Math.min(...toate.map((p) => p[1]));
    conv = ([X, Y]) => [round(Y - Y0), round(X - X0)];
  }

  const poligon = (el) => ({ ...el, puncte: parsePuncte(el.puncte).map(conv) });
  const parcele = (brut.parcele ?? []).map(poligon).filter((p) => p.puncte.length >= 3);
  const zone = (brut.zone ?? []).map(poligon).filter((z) => z.puncte.length >= 2);
  const repere = (brut.repere ?? [])
    .map((r) => ({ ...r, x: Number(r.x), y: Number(r.y) }))
    .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y));

  // Spaliere: o linie (2+ puncte) plus lista pomilor palisați pe ea. Pozițiile lor NU se
  // țin în pozitii.json — se calculează aici, la distanțe egale de-a lungul liniei, cu
  // jumătate de pas la capete. Muți un capăt, se mută toți pomii.
  const spaliere = (brut.spaliere ?? [])
    .map((s) => {
      const puncte = parsePuncte(s.puncte).map(conv);
      const pomi = (Array.isArray(s.pomi) ? s.pomi : [s.pomi]).filter(Boolean).map(String);
      return { ...s, puncte, pomi, adancime: Number(s.adancime_m) || 0.6 };
    })
    .filter((s) => s.puncte.length >= 2 && s.pomi.length)
    .map((s) => {
      const n = s.pomi.length;
      const d = Number(s.distanta_m) || 0;
      const m = Number(s.margine_m) || 0;
      const desenata = lungime(s.puncte);

      // Cu `distanta_m` dat, LUNGIMEA VINE DIN CONSTRÂNGERE: 2 x margine + (n-1) x distanță.
      // Punctele dau doar direcția; linia se întinde sau se scurtează la lungimea cerută.
      // Fără `distanta_m`, se împarte linia desenată în n pași egali (jumătate la capete).
      const conditionat = d > 0;
      const L = conditionat ? 2 * m + (n - 1) * d : desenata;
      const puncte = conditionat ? intinde(s.puncte, L) : s.puncte;
      const pas = conditionat ? d : L / n;
      const prim = conditionat ? m : pas / 2;

      return {
        ...s,
        puncte,
        lungime: round(L),
        lungime_desenata: round(desenata),
        pas: round(pas),
        margine: round(conditionat ? m : pas / 2),
        conditionat,
        locuri: s.pomi.map((id, i) => {
          const { x, y, ux, uy } = pePolilinie(puncte, prim + pas * i);
          return { id, x: round(x), y: round(y), ux, uy };
        }),
      };
    });

  const pct = [...parcele, ...zone, ...spaliere].flatMap((p) => p.puncte).concat(repere.map((r) => [r.x, r.y]));
  if (!pct.length) pct.push([0, 0], [40, 40]);
  const xs = pct.map((p) => p[0]);
  const ys = pct.map((p) => p[1]);
  const limite = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };

  return {
    nume: brut.nume ?? '',
    localitate: brut.localitate ?? '',
    sistem,
    parcele,
    zone,
    spaliere,
    repere,
    limite,
    suprafata: parcele.reduce((s, p) => s + Math.abs(arie(p.puncte)), 0),
  };
}

export const arie = (pts) =>
  pts.reduce((s, [x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    return s + (x1 * y2 - x2 * y1);
  }, 0) / 2;

/** Reface polilinia la lungimea `L`, păstrând punctul de start și direcțiile. */
export function intinde(pts, L) {
  const L0 = lungime(pts);
  if (!L0) return pts;
  const k = L / L0;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    out.push([out[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, out[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]);
  }
  return out;
}

/** Lungimea unei polilinii, în metri. */
export function lungime(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Punctul aflat la distanța `d` de-a lungul poliliniei, plus direcția locală (versor). */
export function pePolilinie(pts, d) {
  let ramas = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ultim = i === pts.length - 1;
    if (ramas <= L || ultim) {
      const t = L ? Math.min(ramas, L) / L : 0;
      return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, ux: L ? (x2 - x1) / L : 1, uy: L ? (y2 - y1) / L : 0 };
    }
    ramas -= L;
  }
  const [x, y] = pts[0] ?? [0, 0];
  return { x, y, ux: 1, uy: 0 };
}

export function centru(pts) {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

const round = (v) => Math.round(v * 100) / 100;
