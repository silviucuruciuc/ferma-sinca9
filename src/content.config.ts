import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Scheme permisive: o greșeală făcută din CMS nu trebuie să oprească tot site-ul.
// Normalizarea finală se face în src/lib/date.js.
const gol = (v: unknown) => v === '' || v === null || v === undefined;
const text = z.preprocess((v) => (gol(v) ? undefined : String(v)), z.string().optional());
const numar = z.preprocess((v) => (gol(v) ? undefined : Number(String(v).replace(',', '.'))), z.number().optional());
const data = z.preprocess((v) => (gol(v) ? undefined : v), z.coerce.date().optional());
const lista = z.preprocess(
  (v) => (gol(v) ? [] : (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'object' && x ? Object.values(x)[0] : x)).filter((x) => !gol(x)).map(String)),
  z.array(z.string()),
);

const pomi = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/pomi' }),
  schema: z
    .object({
      id: text,
      nr_inventar: numar,
      specie: z.string(),
      soi: text,
      portaltoi: text,
      forma: text,
      stare: text,
      data_plantare: data,
      pepiniera: text,
      comanda: text,
      talie: text,
      coroana_m: numar,
      productie_estimata: text,
      conducere: text,
      foto: text,
      note: text,
    })
    .loose(),
});

const soiuri = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/soiuri' }),
  schema: z
    .object({
      nume: z.string(),
      specie: text,
      coacere: text,
      utilizare: text,
      polenizare: text,
      polenizatori: lista,
      rezistenta: text,
      note: text,
      rezumat: text,
      pepiniera_url: text,
      de_verificat: text,
    })
    .loose(),
});

const portaltoiuri = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/portaltoiuri' }),
  schema: z
    .object({
      nume: z.string(),
      specii: lista,
      vigoare: text,
      talie: text,
      tutorare: text,
      distante: text,
      sol: text,
      precocitate: text,
      rezumat: text,
      pepiniera_url: text,
    })
    .loose(),
});

const jurnal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/jurnal' }),
  schema: z
    .object({
      titlu: z.string(),
      data: z.coerce.date(),
      tip: z.preprocess((v) => (gol(v) ? 'observatie' : v), z.string()),
      pomi: lista,
      specii: lista,
      toata_livada: z.preprocess((v) => v === true || v === 'true', z.boolean()),
      stare_sanatate: text,
      inaltime_cm: numar,
      trunchi_mm: numar,
      recolta_kg: numar,
      produs: text,
      poze: lista,
    })
    .loose(),
});

export const collections = { pomi, soiuri, portaltoiuri, jurnal };
