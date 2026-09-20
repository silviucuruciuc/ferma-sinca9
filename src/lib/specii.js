// Metadate comune: specii, stări, tipuri de jurnal.
// Folosit de site (Astro), de configurația CMS și de scriptul de import din Excel.

/** Grupe pentru legendă și filtre. `forma` = forma simbolului pe plan. */
export const GRUPE = {
  pomacee: { nume: 'Semințoase', forma: 'cerc' },
  samburoase: { nume: 'Sâmburoase', forma: 'cerc' },
  nuci: { nume: 'Nuciferi', forma: 'cerc' },
  exotice: { nume: 'Experimente', forma: 'cerc' },
  arbusti: { nume: 'Arbuști fructiferi', forma: 'patrat' },
  ornamentale: { nume: 'Ornamentali', forma: 'romb' },
};

/** Specii. Culorile sunt singurele culori saturate de pe plan. */
export const SPECII = {
  mar: { nume: 'Măr', latin: 'Malus domestica', grupa: 'pomacee', culoare: '#B3302B' },
  par: { nume: 'Păr', latin: 'Pyrus communis', grupa: 'pomacee', culoare: '#8A8419' },
  gutui: { nume: 'Gutui', latin: 'Cydonia oblonga', grupa: 'pomacee', culoare: '#C0951C' },
  mosmon: { nume: 'Moșmon', latin: 'Mespilus germanica', grupa: 'pomacee', culoare: '#86613A' },
  cires: { nume: 'Cireș', latin: 'Prunus avium', grupa: 'samburoase', culoare: '#6B1633' },
  visin: { nume: 'Vișin', latin: 'Prunus cerasus', grupa: 'samburoase', culoare: '#B0304C' },
  prun: { nume: 'Prun', latin: 'Prunus domestica', grupa: 'samburoase', culoare: '#4E3B86' },
  cais: { nume: 'Cais', latin: 'Prunus armeniaca', grupa: 'samburoase', culoare: '#D0751F' },
  nectarin: { nume: 'Nectarin', latin: 'Prunus persica var. nucipersica', grupa: 'samburoase', culoare: '#CC5A43' },
  piersic: { nume: 'Piersic', latin: 'Prunus persica', grupa: 'samburoase', culoare: '#D9826A' },
  alun: { nume: 'Alun', latin: 'Corylus avellana', grupa: 'nuci', culoare: '#7A5B35' },
  smochin: { nume: 'Smochin', latin: 'Ficus carica', grupa: 'exotice', culoare: '#2E7D6F' },
  asimina: { nume: 'Asimina', latin: 'Asimina triloba (pawpaw)', grupa: 'exotice', culoare: '#3E8A55' },
  aronia: { nume: 'Aronia', latin: 'Aronia sp.', grupa: 'arbusti', culoare: '#2D3A73' },
  agris: { nume: 'Agriș', latin: 'Ribes uva-crispa', grupa: 'arbusti', culoare: '#5B8A36' },
  coacaz: { nume: 'Coacăz', latin: 'Ribes rubrum', grupa: 'arbusti', culoare: '#C0323A' },
  afin: { nume: 'Afin', latin: 'Vaccinium corymbosum', grupa: 'arbusti', culoare: '#3A5CA3' },
  merisor: { nume: 'Merișor', latin: 'Vaccinium macrocarpon', grupa: 'arbusti', culoare: '#9A2A3C' },
  iosta: { nume: 'Iostă', latin: 'Ribes × nidigrolaria', grupa: 'arbusti', culoare: '#4B2F60' },
  amelanchier: { nume: 'Amelanchier', latin: 'Amelanchier sp.', grupa: 'arbusti', culoare: '#5A4B8E' },
  zmeur: { nume: 'Zmeur arctic', latin: 'Rubus arcticus', grupa: 'arbusti', culoare: '#C2456B' },
  loganberry: { nume: 'Loganberry', latin: 'Rubus × loganobaccus', grupa: 'arbusti', culoare: '#8C2F53' },
  goumi: { nume: 'Goumi', latin: 'Elaeagnus multiflora', grupa: 'arbusti', culoare: '#B1542D' },
  calin: { nume: 'Călin', latin: 'Viburnum opulus', grupa: 'ornamentale', culoare: '#6F6AAE' },
  iasomie: { nume: 'Iasomie', latin: 'Philadelphus coronarius', grupa: 'ornamentale', culoare: '#8B80B5' },
  liliac: { nume: 'Liliac', latin: 'Syringa vulgaris', grupa: 'ornamentale', culoare: '#9A68B3' },
  magnolie: { nume: 'Magnolie', latin: 'Magnolia', grupa: 'ornamentale', culoare: '#B05C8E' },
  altele: { nume: 'Altă specie', latin: '', grupa: 'exotice', culoare: '#6B716E' },
};

export const specie = (cod) => SPECII[cod] ?? { ...SPECII.altele, nume: cod || SPECII.altele.nume };

/** Starea unui pom. `istoric` = nu mai e în livadă (ascuns implicit pe plan). */
export const STARI = {
  comandat: { nume: 'Comandat' },
  plantat: { nume: 'Plantat' },
  vechi: { nume: 'Vechi' },
  observatie: { nume: 'Sub observație' },
  problema: { nume: 'Problemă' },
  uscat: { nume: 'Uscat', istoric: true },
  inlocuit: { nume: 'Înlocuit', istoric: true },
  scos: { nume: 'Scos', istoric: true },
};

export const stare = (cod) => STARI[cod] ?? { nume: cod || 'Necunoscută' };

/** Tipuri de înregistrări în jurnal. `interventie` = contează la „intervenții” pe an. */
export const TIPURI = {
  observatie: { nume: 'Observație' },
  plantare: { nume: 'Plantare' },
  taiere: { nume: 'Tăiere', interventie: true },
  tratament: { nume: 'Tratament', interventie: true },
  fertilizare: { nume: 'Fertilizare', interventie: true },
  irigare: { nume: 'Irigare', interventie: true },
  altoire: { nume: 'Altoire', interventie: true },
  protectie: { nume: 'Protecție (iarnă, rozătoare)', interventie: true },
  problema: { nume: 'Problemă (boală, dăunător)' },
  masuratoare: { nume: 'Măsurătoare' },
  inflorire: { nume: 'Înflorire' },
  recolta: { nume: 'Recoltă' },
  inlocuire: { nume: 'Înlocuire' },
};

export const tip = (cod) => TIPURI[cod] ?? { nume: cod || 'Notă' };

export const FORME = {
  altoit: 'Pom altoit',
  tufa: 'Tufă (pe rădăcini proprii)',
  tulpina: 'Altoit pe tulpină',
  tapisant: 'Tapisant',
  liana: 'Liană / tărâtor',
  nealtoit: 'Nealtoit (din sămânță)',
};

export const CONDUCERI = ['vas', 'ax central', 'palmetă', 'gard fructifer', 'tufă', 'liberă'];

export const POLENIZARE = {
  autofertil: 'Autofertil',
  partial: 'Parțial autofertil',
  autosteril: 'Autosteril — are nevoie de polenizator',
  necunoscut: 'Necunoscut',
};

/** Diametrul coroanei la maturitate (m), după portaltoi — egal cu distanța de plantare din planul tău. */
export const COROANA_DUPA_PORTALTOI = {
  m106: 4.5,
  m26: 3.5,
  m9: 3,
  'franc-par': 5,
  'gutui-a': 3.5,
  colt: 5.5,
  mahaleb: 5.5,
  'gisela-6': 4,
  'gisela-5': 3.5,
  mirobolan: 4.5,
};

/** Normalizare text pentru căutări: fără diacritice, litere mici. */
export const normalizeaza = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const slug = (s) =>
  normalizeaza(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** „mar-07” -> „Măr 07” */
export function etichetaPom(id, codSpecie) {
  const m = /^(.*?)-(\d+)$/.exec(id ?? '');
  const nume = specie(codSpecie ?? m?.[1]).nume;
  return m ? `${nume} ${m[2]}` : String(id);
}
