#!/usr/bin/env node
// GARDA: codul și site-ul ajung DOAR în conturile personale (GitHub + Cloudflare),
// niciodată în Fortech Products / Aiperion.
//
//   node scripts/garda.mjs              verificare locală (remote git, email, gh, wrangler)
//   node scripts/garda.mjs --push URL   rulat de hook-ul pre-push
//   node scripts/garda.mjs --ci         rulat în GitHub Actions înainte de deploy
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const cfg = JSON.parse(readFileSync('ferma.config.json', 'utf8'));
const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
const interzis = new RegExp(cfg.garda.nume_interzise.join('|'), 'i');
const emailInterzis = (e) => cfg.garda.emailuri_interzise.some((x) => e.toLowerCase().includes(x.toLowerCase()));
const { owner, repo } = cfg.github;
const cont = wrangler.account_id;

const erori = [];
const ok = (m) => console.log(`  ✔ ${m}`);
const eroare = (m) => erori.push(m);
const rulez = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
const arg = process.argv.slice(2);

console.log('Garda conturilor (Fortech / Aiperion interzise):');

if (!owner || /^COMPLETEAZA/.test(owner)) eroare('Completează github.owner în ferma.config.json cu userul tău GitHub PERSONAL.');
else if (interzis.test(owner)) eroare(`github.owner „${owner}” arată a cont de firmă.`);
else ok(`repo configurat: ${owner}/${repo}`);

if (!cont || /^COMPLETEAZA/.test(cont)) eroare('Completează account_id în wrangler.jsonc cu ID-ul contului Cloudflare PERSONAL.');
else ok(`cont Cloudflare configurat: ${cont}`);

const remoteCorect = (url) => new RegExp(`github\\.com[:/]${owner}/${repo}(\\.git)?/?$`, 'i').test(url);

if (arg[0] === '--push') {
  const url = arg[1] ?? '';
  if (interzis.test(url)) eroare(`Push blocat: ${url} e în contul firmei.`);
  else if (!remoteCorect(url)) eroare(`Push blocat: ${url} nu e ${owner}/${repo}.`);
  else ok(`push către ${url}`);
  const email = rulez('git config user.email') ?? '';
  if (emailInterzis(email)) eroare(`git user.email e „${email}”. Pentru acest repo: git config user.email <emailul-personal>`);
} else if (arg[0] === '--ci') {
  const proprietar = process.env.GITHUB_REPOSITORY_OWNER ?? '';
  if (interzis.test(proprietar) || proprietar.toLowerCase() !== String(owner).toLowerCase()) eroare(`Workflow-ul rulează în „${proprietar}”, nu în ${owner}.`);
  else ok(`workflow în contul ${proprietar}`);
  const idSecret = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
  if (idSecret !== cont) eroare('Secretul CLOUDFLARE_ACCOUNT_ID nu e același cu account_id din wrangler.jsonc.');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (token && cont && !/^COMPLETEAZA/.test(cont)) {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cont}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (j?.result?.name) {
      if (interzis.test(j.result.name)) eroare(`Contul Cloudflare „${j.result.name}” e al firmei.`);
      else ok(`cont Cloudflare: ${j.result.name}`);
    } else console.log('  ! Numele contului Cloudflare nu poate fi citit cu acest token; verific doar ID-ul.');
  }
} else {
  const url = rulez('git remote get-url origin');
  if (url) (remoteCorect(url) && !interzis.test(url) ? ok(`remote origin: ${url}`) : eroare(`remote origin e ${url}, nu ${owner}/${repo}.`));
  const email = rulez('git config user.email') ?? '';
  if (emailInterzis(email)) eroare(`git user.email e „${email}”. Rulează: git config user.email <emailul-personal>`);
  const gh = rulez('gh api user -q .login');
  if (gh) (gh.toLowerCase() === String(owner).toLowerCase() ? ok(`gh logat ca ${gh}`) : eroare(`gh e logat ca „${gh}”, nu „${owner}”. Rulează: gh auth switch`));
  const who = rulez('npx --no-install wrangler whoami');
  if (who && /Account ID/i.test(who)) {
    const linie = who.split('\n').find((l) => l.includes(cont)) ?? '';
    if (!linie) eroare(`wrangler nu are acces la contul ${cont}. Rulează: npx wrangler logout && npx wrangler login`);
    else if (interzis.test(linie)) eroare(`Contul Cloudflare ${cont} pare al firmei: ${linie.trim()}`);
    else ok('wrangler are acces la contul configurat');
  }
}

if (erori.length) {
  console.error(`\n✖ Oprit:\n${erori.map((e) => `  - ${e}`).join('\n')}\n`);
  process.exit(1);
}
console.log('Totul e în regulă.\n');
