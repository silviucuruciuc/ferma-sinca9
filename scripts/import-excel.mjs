#!/usr/bin/env node
// Importă inventarul din Excel în fișiere YAML (pomi, soiuri, portaltoiuri).
//
//   node scripts/import-excel.mjs inventar.xlsx            # doar arată ce ar face
//   node scripts/import-excel.mjs inventar.xlsx --scrie    # scrie fișierele
//
// Opțiuni: --foaie "Inventar complet"  --comanda "Toamna 2026"  --pepiniera "Pepinierele Roman"
//
// E idempotent: un rând deja importat (același nr. de inventar + același soi) e sărit,
// iar fișele de soi/portaltoi existente nu sunt suprascrise (le poți edita liniștit din CMS).

import ExcelJS from 'exceljs';
import * as yaml from 'js-yaml';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeaza, slug, COROANA_DUPA_PORTALTOI } from '../src/lib/specii.js';

const arg = process.argv.slice(2);
const fisier = arg.find((a) => !a.startsWith('--') && /\.xlsx?$/i.test(a));
const opt = (nume, implicit) => {
  const i = arg.indexOf(`--${nume}`);
  return i >= 0 && arg[i + 1] && !arg[i + 1].startsWith('--') ? arg[i + 1] : implicit;
};
const scrie = arg.includes('--scrie');
const numeFoaie = opt('foaie', 'Inventar complet');
const comanda = opt('comanda', 'Toamna 2026');
const pepiniera = opt('pepiniera', 'Pepinierele Roman');

if (!fisier) {
  console.error('Folosire: node scripts/import-excel.mjs <fisier.xlsx> [--scrie]');
  process.exit(1);
}

const DIR = {
  pomi: 'src/content/pomi',
  soiuri: 'src/content/soiuri',
  portaltoiuri: 'src/content/portaltoiuri',
};
Object.values(DIR).forEach((d) => mkdirSync(d, { recursive: true }));

// ------------------------------------------------------------------ mapări
const DUPA_CATEGORIE = {
  mar: 'mar', par: 'par', cires: 'cires', visin: 'visin', prun: 'prun', alun: 'alun',
  mosmon: 'mosmon', cais: 'cais', gutui: 'gutui', nectarin: 'nectarin', piersic: 'piersic',
};

// Pentru categoriile „EXOTIC / ARBUST / ORNAMENT” specia se deduce din nume. Ordinea contează.
const DUPA_NUME = [
  [/smochin/, 'smochin'],
  [/pawpaw|asimina/, 'asimina'],
  [/amelanchier|afin canadian/, 'amelanchier'],
  [/aronia|scorus/, 'aronia'],
  [/agris/, 'agris'],
  [/coacaz/, 'coacaz'],
  [/afin/, 'afin'],
  [/merisor/, 'merisor'],
  [/iosta/, 'iosta'],
  [/zmeur/, 'zmeur'],
  [/loganberry/, 'loganberry'],
  [/elaeagnus|goumi/, 'goumi'],
  [/viburnum|calin/, 'calin'],
  [/iasomie|philadelphus/, 'iasomie'],
  [/liliac|syringa/, 'liliac'],
];

function deduceSpecie(categorie, soi) {
  const c = normalizeaza(categorie);
  if (DUPA_CATEGORIE[c]) return DUPA_CATEGORIE[c];
  const n = normalizeaza(soi);
  return DUPA_NUME.find(([re]) => re.test(n))?.[1] ?? 'altele';
}

const PORTALTOI = [
  [/m\s*-?\s*106/, 'm106', 'M106'],
  [/m\s*-?\s*26/, 'm26', 'M26'],
  [/m\s*-?\s*9\b/, 'm9', 'M9'],
  [/gutui\s*a/, 'gutui-a', 'Gutui A'],
  [/gis+el+a\s*6/, 'gisela-6', 'Gisela 6'],
  [/gis+el+a\s*5/, 'gisela-5', 'Gisela 5'],
  [/colt/, 'colt', 'Colt'],
  [/mahaleb/, 'mahaleb', 'Mahaleb'],
  [/mirobolan|myrobalan/, 'mirobolan', 'Mirobolan'],
  [/franc|salbatic|pyraster|pyrus/, 'franc-par', 'Franc (Pyrus pyraster)'],
];
const FORMA = [
  [/^tufa/, 'tufa'],
  [/tulpina/, 'tulpina'],
  [/tapisant/, 'tapisant'],
  [/liana/, 'liana'],
];

function deducePortaltoi(text) {
  const n = normalizeaza(text);
  if (!n || n === '-') return { portaltoi: null, forma: null };
  const f = FORMA.find(([re]) => re.test(n));
  if (f) return { portaltoi: null, forma: f[1] };
  const p = PORTALTOI.find(([re]) => re.test(n));
  return p ? { portaltoi: p[1], numePortaltoi: p[2], forma: 'altoit' } : { portaltoi: slug(text), numePortaltoi: String(text).trim(), forma: 'altoit' };
}

/** Diametrul coroanei: din portaltoi (= distanța de plantare din plan), altfel din „talie”. */
function coroana(portaltoi, talie) {
  if (portaltoi && COROANA_DUPA_PORTALTOI[portaltoi]) return COROANA_DUPA_PORTALTOI[portaltoi];
  const nr = String(talie ?? '').replace(',', '.').match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nr.length) return Math.min(6, Math.max(1.2, Math.max(...nr)));
  if (/tarator|liana/i.test(normalizeaza(talie))) return 1.5;
  if (/mic/i.test(normalizeaza(talie))) return 2;
  return 3;
}

// ------------------------------------------------------------------ citire Excel
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(fisier);
const ws = wb.getWorksheet(numeFoaie) ?? wb.worksheets[0];
const valoare = (c) => {
  const v = c?.value;
  if (v == null) return '';
  if (typeof v === 'object') return v.richText ? v.richText.map((t) => t.text).join('') : (v.result ?? v.text ?? '');
  return v;
};

let antet = null;
const randuri = [];
ws.eachRow((row) => {
  const celule = row.values.slice(1).map((v, i) => valoare(row.getCell(i + 1)));
  const norm = celule.map((c) => normalizeaza(c));
  if (!antet) {
    if (norm.includes('categorie') && norm.includes('soi')) antet = norm;
    return;
  }
  const r = {};
  antet.forEach((h, i) => (r[h] = celule[i]));
  if (String(r.soi ?? '').trim()) randuri.push(r);
});
if (!antet) {
  console.error(`N-am găsit rândul de antet (Categorie / Soi) în foaia „${ws.name}”.`);
  process.exit(1);
}
const col = (r, ...chei) => {
  for (const k of chei) {
    const cheie = Object.keys(r).find((h) => h.startsWith(k));
    const v = cheie ? r[cheie] : null;
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
};

// ------------------------------------------------------------------ starea existentă
const citesteYaml = (dir) =>
  readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => ({ id: f.replace(/\.ya?ml$/, ''), ...(yaml.load(readFileSync(join(dir, f), 'utf8')) ?? {}) }));

const pomiExistenti = citesteYaml(DIR.pomi);
const soiuriExistente = new Map(citesteYaml(DIR.soiuri).map((s) => [s.id, s]));
const portaltoiExistente = new Set(citesteYaml(DIR.portaltoiuri).map((p) => p.id));
const deja = new Set(pomiExistenti.map((p) => `${p.nr_inventar}|${normalizeaza(soiuriExistente.get(p.soi)?.nume ?? p.soi)}`));
const ultimul = {};
for (const p of pomiExistenti) {
  const m = /^(.*)-(\d+)$/.exec(p.id);
  if (m) ultimul[m[1]] = Math.max(ultimul[m[1]] ?? 0, Number(m[2]));
}

// ------------------------------------------------------------------ transformare
const noi = { pomi: [], soiuri: new Map(), portaltoiuri: new Map() };
let sarite = 0;

for (const r of randuri) {
  const nr = Number(col(r, '#', 'nr')) || null;
  const numeSoi = col(r, 'soi');
  const specie = deduceSpecie(col(r, 'categorie'), numeSoi);
  if (deja.has(`${nr}|${normalizeaza(numeSoi)}`)) {
    sarite++;
    continue;
  }
  const { portaltoi, numePortaltoi, forma } = deducePortaltoi(col(r, 'portaltoi'));
  const note = col(r, 'note');
  const plantat = /\bplantat\b/i.test(note);

  // „Aronia Viking” (specia aronia) -> aronia-viking, nu aronia-aronia-viking.
  const slugSoi = slug(numeSoi);
  const idSoi = `${specie}-${slugSoi.startsWith(`${specie}-`) ? slugSoi.slice(specie.length + 1) : slugSoi}`;
  if (!soiuriExistente.has(idSoi) && !noi.soiuri.has(idSoi)) {
    noi.soiuri.set(idSoi, curata({
      nume: numeSoi,
      specie,
      coacere: col(r, 'coacere'),
      utilizare: col(r, 'utilizare'),
      polenizare: /autofertil/i.test(note) ? 'autofertil' : /autosteril/i.test(note) ? 'autosteril' : 'necunoscut',
      note: note.replace(/\bPLANTAT\b,?\s*/i, '').trim(),
    }));
  }
  if (portaltoi && !portaltoiExistente.has(portaltoi) && !noi.portaltoiuri.has(portaltoi)) {
    noi.portaltoiuri.set(portaltoi, { nume: numePortaltoi, specii: [specie] });
  } else if (portaltoi && noi.portaltoiuri.has(portaltoi)) {
    const pt = noi.portaltoiuri.get(portaltoi);
    if (!pt.specii.includes(specie)) pt.specii.push(specie);
  }

  const n = (ultimul[specie] = (ultimul[specie] ?? 0) + 1);
  const id = `${specie}-${String(n).padStart(2, '0')}`;
  const extra = [col(r, 'unde plantat') && `Loc: ${col(r, 'unde plantat')}`, col(r, 'obs') && `Obs.: ${col(r, 'obs')}`].filter(Boolean).join(' · ');
  noi.pomi.push(curata({
    id,
    nr_inventar: nr,
    specie,
    soi: idSoi,
    portaltoi,
    forma,
    stare: plantat ? 'plantat' : 'comandat',
    pepiniera: plantat ? '' : pepiniera,
    comanda: plantat ? '' : comanda,
    talie: col(r, 'vigoare', 'talie'),
    coroana_m: coroana(portaltoi, col(r, 'vigoare', 'talie')),
    productie_estimata: col(r, 'productie') ? `${col(r, 'productie')} kg/an la maturitate` : '',
    note: extra,
  }));
}

function curata(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)));
}

// ------------------------------------------------------------------ raport + scriere
const dump = (o) => yaml.dump(o, { lineWidth: 110, noRefs: true, quotingType: '"' });

console.log(`Foaia „${ws.name}”: ${randuri.length} rânduri · ${noi.pomi.length} pomi noi · ${sarite} deja importați`);
console.log(`Fișe noi: ${noi.soiuri.size} soiuri, ${noi.portaltoiuri.size} portaltoiuri\n`);
for (const p of noi.pomi) {
  console.log(`  ${p.id.padEnd(15)} ${String(p.nr_inventar ?? '').padStart(3)}  ${p.soi.padEnd(34)} ${(p.portaltoi ?? p.forma ?? '-').padEnd(10)} ${p.stare}`);
}

if (!scrie) {
  console.log('\nNimic scris. Rulează din nou cu --scrie ca să creezi fișierele.');
  process.exit(0);
}
for (const p of noi.pomi) writeFileSync(join(DIR.pomi, `${p.id}.yaml`), dump(p));
for (const [id, s] of noi.soiuri) writeFileSync(join(DIR.soiuri, `${id}.yaml`), dump(s));
for (const [id, p] of noi.portaltoiuri) writeFileSync(join(DIR.portaltoiuri, `${id}.yaml`), dump(p));
console.log('\nGata. Verifică fișierele, apoi commit + push.');
