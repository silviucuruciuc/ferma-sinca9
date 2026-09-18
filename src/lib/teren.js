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

  const pct = [...parcele, ...zone].flatMap((p) => p.puncte).concat(repere.map((r) => [r.x, r.y]));
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

export function centru(pts) {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

const round = (v) => Math.round(v * 100) / 100;
