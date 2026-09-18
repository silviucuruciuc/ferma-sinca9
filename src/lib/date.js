import { getCollection } from 'astro:content';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import config from '../../ferma.config.json';
import { SPECII, GRUPE, specie, stare, tip, etichetaPom, normalizeaza, COROANA_DUPA_PORTALTOI } from './specii.js';
import { normalizeazaTeren } from './teren.js';

export const SITE = config.site;
export const GITHUB = config.github;
export const repoConfigurat = !/^COMPLETEAZA/.test(GITHUB.owner ?? '') && !!GITHUB.owner;

const citeste = (cale, parse) => {
  const f = resolve(process.cwd(), cale);
  return existsSync(f) ? parse(readFileSync(f, 'utf8')) : null;
};

const urlAdmin = (hash) => `/admin/#/${hash}`;
export const linkCMS = {
  pom: (id) => urlAdmin(`collections/pomi/entries/${id}`),
  soi: (id) => urlAdmin(`collections/soiuri/entries/${id}`),
  portaltoi: (id) => urlAdmin(`collections/portaltoiuri/entries/${id}`),
  jurnalNou: (param = {}) => urlAdmin(`collections/jurnal/new?${new URLSearchParams(param)}`),
  intrare: (id) => urlAdmin(`collections/jurnal/entries/${id}`),
  teren: () => urlAdmin('collections/setari/entries/teren'),
  pozitii: () => urlAdmin('collections/setari/entries/pozitii'),
};

export const cautaLaPepiniera = (text) =>
  `https://pepinierele-roman.ro/?${new URLSearchParams({ s: text, post_type: 'product' })}`;

let cache;
export function incarca() {
  if (!cache || !import.meta.env.PROD) cache = construieste();
  return cache;
}

async function construieste() {
  const [pomiC, soiuriC, portaltoiC, jurnalC] = await Promise.all([
    getCollection('pomi'),
    getCollection('soiuri'),
    getCollection('portaltoiuri'),
    getCollection('jurnal'),
  ]);

  const soiuri = new Map(soiuriC.map((e) => [e.id, { id: e.id, ...e.data, url: `/soiuri/${e.id}/` }]));
  const portaltoiuri = new Map(portaltoiC.map((e) => [e.id, { id: e.id, ...e.data, url: `/portaltoiuri/${e.id}/` }]));

  const teren = normalizeazaTeren(citeste('src/data/teren.yaml', (t) => yaml.load(t)) ?? {});
  const pozBrut = citeste('src/data/pozitii.json', JSON.parse) ?? { pozitii: [] };
  const pozitii = new Map(
    (pozBrut.pozitii ?? [])
      .filter((p) => p?.pom && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
      .map((p) => [p.pom, { x: Number(p.x), y: Number(p.y) }]),
  );

  // Pomii de pe spalier își iau poziția din structură, nu din pozitii.json — dacă apar și
  // acolo (rămășiță de la o așezare manuală), spalierul are prioritate.
  const peSpalier = new Map();
  for (const s of teren.spaliere)
    for (const l of s.locuri)
      peSpalier.set(l.id, { x: l.x, y: l.y, spalier: s.nume, ux: l.ux, uy: l.uy, latime: s.pas, adancime: s.adancime });

  const jurnal = jurnalC
    .map((e) => ({
      id: e.id,
      ...e.data,
      an: e.data.data.getFullYear(),
      tipInfo: tip(e.data.tip),
      html: e.rendered?.html ?? '',
      poze: e.data.poze ?? [],
    }))
    .sort((a, b) => b.data - a.data || a.titlu.localeCompare(b.titlu));

  const pomi = pomiC
    .map((e) => {
      const d = e.data;
      const id = e.id;
      const sp = specie(d.specie);
      const soi = d.soi ? soiuri.get(d.soi) : null;
      const pt = d.portaltoi ? portaltoiuri.get(d.portaltoi) : null;

      const aplicabile = jurnal
        .filter((j) => j.pomi.includes(id) || j.specii.includes(d.specie) || j.toata_livada)
        .sort((a, b) => a.data - b.data);
      const plantare = aplicabile.find((j) => j.tip === 'plantare' && j.pomi.includes(id));

      let st = d.stare || 'comandat';
      if (st === 'comandat' && plantare) st = 'plantat';
      const dataPlantare = d.data_plantare ?? plantare?.data ?? null;

      return {
        id,
        nr: d.nr_inventar ?? null,
        specie: d.specie,
        specieInfo: sp,
        grupa: sp.grupa,
        forma: GRUPE[sp.grupa]?.forma ?? 'cerc',
        eticheta: etichetaPom(id, d.specie),
        soiId: d.soi ?? null,
        soi,
        soiNume: soi?.nume ?? d.soi ?? 'Soi necunoscut',
        portaltoiId: d.portaltoi ?? null,
        portaltoi: pt,
        portaltoiNume: pt?.nume ?? d.portaltoi ?? null,
        formaCrestere: d.forma ?? null,
        stare: st,
        stareInfo: stare(st),
        dataPlantare,
        pepiniera: d.pepiniera ?? null,
        comanda: d.comanda ?? null,
        talie: d.talie ?? null,
        coroana: d.coroana_m ?? COROANA_DUPA_PORTALTOI[d.portaltoi] ?? 3,
        productie: d.productie_estimata ?? null,
        conducere: d.conducere ?? null,
        foto: d.foto ?? null,
        note: d.note ?? null,
        pozitie: peSpalier.get(id) ?? pozitii.get(id) ?? null,
        spalier: peSpalier.get(id)?.spalier ?? null,
        jurnal: aplicabile,
        ani: rezumatPeAni(id, aplicabile),
        url: `/pomi/${id}/`,
        qr: `${SITE.url.replace(/\/$/, '')}/pomi/${id}/`,
      };
    })
    .sort(comparaPomi);

  const pomById = new Map(pomi.map((p) => [p.id, p]));
  return { pomi, pomById, soiuri, portaltoiuri, jurnal, teren, pozitii };
}

// Ordinea speciilor = ordinea din SPECII; în cadrul speciei, după număr.
const ordineSpecii = Object.keys(SPECII);
function comparaPomi(a, b) {
  const sa = ordineSpecii.indexOf(a.specie);
  const sb = ordineSpecii.indexOf(b.specie);
  if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
  return a.id.localeCompare(b.id, 'ro', { numeric: true });
}

/** Evoluția pe ani. Recolta și măsurătorile contează doar din înregistrările făcute pentru UN singur pom. */
function rezumatPeAni(id, intrari) {
  const ani = new Map();
  for (const j of intrari) {
    if (!ani.has(j.an)) ani.set(j.an, { an: j.an, intrari: [], recolta: null, inaltime: null, trunchi: null, interventii: 0, probleme: 0, stare: null });
    const a = ani.get(j.an);
    a.intrari.push(j);
    const doarAcesta = j.pomi.length === 1 && j.pomi[0] === id;
    if (doarAcesta && j.recolta_kg != null) a.recolta = (a.recolta ?? 0) + j.recolta_kg;
    if (doarAcesta && j.inaltime_cm != null) a.inaltime = j.inaltime_cm;
    if (doarAcesta && j.trunchi_mm != null) a.trunchi = j.trunchi_mm;
    if (j.tipInfo.interventie) a.interventii += 1;
    if (j.tip === 'problema' || j.stare_sanatate === 'problema') a.probleme += 1;
    if (j.stare_sanatate) a.stare = j.stare_sanatate;
  }
  return [...ani.values()].sort((a, b) => b.an - a.an);
}

export const STARE_SANATATE = { bun: 'Bun', atentie: 'Atenție', problema: 'Problemă' };

export function polenizatoriInLivada(soi, pomi) {
  if (!soi?.polenizatori?.length) return [];
  const cautat = soi.polenizatori.map(normalizeaza);
  return pomi.filter((p) => p.soiId !== soi.id && p.specie === soi.specie && cautat.some((c) => normalizeaza(p.soiNume).includes(c) || c.includes(normalizeaza(p.soiNume))));
}

const fmtData = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtScurt = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const dataLunga = (d) => (d ? fmtData.format(d) : '');
export const dataScurta = (d) => (d ? fmtScurt.format(d) : '');
export const numar = (v, zecimale = 1) => (v == null ? '' : Number(v).toLocaleString('ro-RO', { maximumFractionDigits: zecimale }));
