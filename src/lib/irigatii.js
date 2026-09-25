// Schița de irigații prin picurare: din src/data/irigatii.yaml + pozițiile pomilor.
// Traseele principale vin din fișier; racordurile la pomi, inelele de picurare, culoarul de
// acces și traversările lui se calculează aici, ca să urmeze pomii și poarta când se mută.
import { parsePuncte, centru, lungime } from './teren.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];

/** Cel mai apropiat punct de pe o polilinie. */
function celMaiAproape(pts, p) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const d = sub(pts[i + 1], a);
    const l2 = dot(d, d);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)) : 0;
    const q = add(a, mul(d, t));
    const dd = dist(p, q);
    if (!best || dd < best.d) best = { q, d: dd };
  }
  return best;
}

/** Partea dintr-un segment aflată într-un poligon convex (Cyrus-Beck), sau null. */
function decupeaza(a, b, poli) {
  const c = centru(poli);
  const d = sub(b, a);
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < poli.length; i++) {
    const p = poli[i];
    const e = sub(poli[(i + 1) % poli.length], p);
    // Normala spre interior, verificată cu centrul poligonului.
    let n = [-e[1], e[0]];
    if (dot(sub(c, p), n) < 0) n = mul(n, -1);
    const num = dot(sub(a, p), n);
    const den = dot(d, n);
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if (t1 - t0 < 1e-6) return null;
  return [add(a, mul(d, t0)), add(a, mul(d, t1))];
}

function seIntersecteaza(a, b, poli) {
  return !!decupeaza(a, b, poli);
}

/** Culoarul de acces: dreptunghi perpendicular pe gard, cât poarta de lat. */
function culoarAcces(teren, adancime) {
  const poarta = teren.zone.find((z) => z.tip === 'poarta');
  if (!poarta || poarta.puncte.length < 2) return null;
  const [g1, g2] = poarta.puncte;
  const mij = centru(teren.parcele[0].puncte);
  const u = sub(g2, g1);
  const l = Math.hypot(...u);
  let n = [-u[1] / l, u[0] / l];
  if (dot(sub(mij, g1), n) < 0) n = mul(n, -1);
  return [g1, g2, add(g2, mul(n, adancime)), add(g1, mul(n, adancime))];
}

export function construiesteIrigatii(brut, teren, pomi) {
  if (!brut?.zone?.length) return null;
  const avertismente = [];
  const pic = { picuratori_pe_pom: 4, debit_lh: 4, inel_m: 0.5, ...(brut.picurare ?? {}) };
  const dupaId = new Map(pomi.map((p) => [p.id, p]));
  const acces = brut.acces ? culoarAcces(teren, Number(brut.acces.adancime_m) || 15) : null;
  const obstacole = teren.zone.filter((z) => z.tip === 'constructie' && z.puncte.length > 2);

  const zone = brut.zone.map((z) => {
    const trasee = (z.trasee ?? []).map(parsePuncte).filter((t) => t.length >= 2);
    const inele = [];
    const laterale = [];
    for (const id of z.pomi ?? []) {
      const p = dupaId.get(id);
      if (!p) {
        avertismente.push(`${z.cod}: pomul „${id}” nu există.`);
        continue;
      }
      if (!p.pozitie) {
        avertismente.push(`${z.cod}: ${p.eticheta} nu e pe plan — nu are racord.`);
        continue;
      }
      const c = [p.pozitie.x, p.pozitie.y];
      const best = trasee.map((t) => celMaiAproape(t, c)).filter(Boolean).sort((a, b) => a.d - b.d)[0];
      if (!best) continue;
      inele.push({ pom: id, eticheta: p.eticheta, x: c[0], y: c[1], r: pic.inel_m });
      if (best.d > pic.inel_m) {
        // Racordul se oprește pe inel, nu în trunchi.
        const capat = add(c, mul(sub(best.q, c), pic.inel_m / best.d));
        laterale.push({ pom: id, de: r2(best.q), la: r2(capat), lungime: best.d - pic.inel_m });
        if (acces && seIntersecteaza(best.q, capat, acces))
          avertismente.push(`${z.cod}: racordul spre ${p.eticheta} trece prin accesul de la poartă.`);
        for (const o of obstacole)
          if (seIntersecteaza(best.q, capat, o.puncte))
            avertismente.push(`${z.cod}: racordul spre ${p.eticheta} trece prin ${o.nume}.`);
      }
    }

    // Traversările accesului și coliziunile traseelor cu construcțiile.
    const traversari = [];
    for (const t of trasee)
      for (let i = 0; i < t.length - 1; i++) {
        if (acces) {
          const d = decupeaza(t[i], t[i + 1], acces);
          if (d) traversari.push({ de: r2(d[0]), la: r2(d[1]), lungime: dist(d[0], d[1]) });
        }
        for (const o of obstacole)
          if (seIntersecteaza(t[i], t[i + 1], o.puncte)) avertismente.push(`${z.cod}: traseul trece prin ${o.nume}.`);
      }

    // Senzorul stă în bulbul de umezeală, pe inel, spre linie, la 25-30 cm adâncime. Pe plan e
    // desenat decalat pe ecran în direcția asta (ux, uy), altfel ar sta sub simbolul pomului.
    let senzor = null;
    const inelSenzor = inele.find((i) => i.pom === z.senzor);
    if (inelSenzor) {
      const l = laterale.find((x) => x.pom === z.senzor);
      const spre = l ? sub(l.de, [inelSenzor.x, inelSenzor.y]) : [1, 0];
      const k = Math.hypot(...spre) || 1;
      senzor = { pom: z.senzor, eticheta: inelSenzor.eticheta, x: inelSenzor.x, y: inelSenzor.y, ux: spre[0] / k, uy: spre[1] / k };
    }
    if (z.senzor && !senzor) avertismente.push(`${z.cod}: senzorul e pus la „${z.senzor}”, care nu e în zonă sau nu e pe plan.`);

    const lPE = trasee.reduce((s, t) => s + lungime(t), 0) + laterale.reduce((s, l) => s + l.lungime, 0);
    const lPicurare = inele.reduce((s, i) => s + 2 * Math.PI * i.r, 0);
    return {
      cod: z.cod,
      nume: z.nume,
      culoare: z.culoare ?? '#2E6FA8',
      trasee,
      laterale,
      inele,
      senzor,
      traversari,
      n: inele.length,
      debit_lh: inele.length * pic.picuratori_pe_pom * pic.debit_lh,
      lungimePE: lPE,
      lungimePicurare: lPicurare,
    };
  });

  const nrTrav = zone.reduce((s, z) => s + z.traversari.length, 0);
  if (acces && nrTrav > zone.length)
    avertismente.push(`Accesul e traversat de ${nrTrav} ori — țintește o singură tranșee comună.`);

  return {
    acces: acces && { nume: brut.acces.nume ?? 'Acces', puncte: acces.map(r2), tub: brut.acces.tub_protectie },
    cutie: brut.cutie ? { x: Number(brut.cutie.x), y: Number(brut.cutie.y), nume: brut.cutie.nume ?? 'Cutie de comandă' } : null,
    picurare: pic,
    zone,
    avertismente,
  };
}
