// Copiază Sveltia CMS din node_modules în public/admin (versiunea fixată de package-lock).
import { cpSync, mkdirSync } from 'node:fs';
const sursa = 'node_modules/@sveltia/cms/dist';
mkdirSync('public/admin', { recursive: true });
cpSync(`${sursa}/sveltia-cms.js`, 'public/admin/sveltia-cms.js');
cpSync(`${sursa}/chunks`, 'public/admin/chunks', { recursive: true, filter: (f) => !f.endsWith('.map') });
