// API-ul chat-ului de pe /asistent/. Conversațiile sunt issue-uri GitHub cu eticheta „asistent”;
// .github/workflows/asistent.yml le preia, face modificarea și răspunde în issue.
//
// Pagina și API-ul sunt în spatele Cloudflare Access. Worker-ul NU se bazează doar pe asta:
// verifică el însuși JWT-ul Access (semnătură, audiență, emailul permis) și refuză tot dacă
// lipsește configurarea — un Access pus greșit n-ar trebui să lase pe oricine să publice pe site.
//
// Variabile (wrangler.jsonc): ACCESS_TEAM_DOMAIN, ACCESS_AUD.
// Secrete (wrangler secret put): ASISTENT_EMAIL, GITHUB_TOKEN_ASISTENT (token fine-grained,
// doar pe acest repo: Issues read/write, Actions read).
import config from '../ferma.config.json';

const { owner, repo } = config.github;
const ETICHETA = 'asistent';
const GH = `https://api.github.com/repos/${owner}/${repo}`;

// Modelul ales în chat călătorește în mesaj ca un comentariu HTML (invizibil pe GitHub);
// asistent.yml îl citește din mesajul care a pornit rularea. Doar cheile de aici sunt acceptate.
export const MODELE = { opus: 'Opus 5.5', sonnet: 'Sonnet 5' };
const MARCAJ = /\n*<!-- model: ([a-z]+) -->\s*$/;
const cuModel = (t, model) => `${t}\n\n<!-- model: ${model} -->`;
const faraModel = (t) => {
  const m = String(t ?? '').match(MARCAJ);
  return { text: String(t ?? '').replace(MARCAJ, ''), model: m && MODELE[m[1]] ? MODELE[m[1]] : null };
};

export async function asistent(request, url, env) {
  const eroare = await verificaAcces(request, env);
  if (eroare) return json({ eroare: eroare.mesaj }, eroare.cod);

  if (request.method === 'POST') {
    // Cerere fetch din pagina noastră: antet propriu + aceeași origine (apără de CSRF).
    if (request.headers.get('X-Asistent') !== '1' || request.headers.get('Origin') !== url.origin)
      return json({ eroare: 'Cerere refuzată.' }, 403);
  }

  const cale = url.pathname.replace(/^\/api\/asistent\/?/, '').replace(/\/$/, '');
  const [resursa, nr] = cale.split('/');
  if (resursa !== 'conversatii') return json({ eroare: 'Nu există.' }, 404);

  try {
    if (!nr && request.method === 'GET') return json(await lista(env));
    if (!nr && request.method === 'POST') return json(await conversatieNoua(await text(request), env), 201);
    if (/^\d+$/.test(nr) && request.method === 'GET') return json(await conversatie(nr, env));
    if (/^\d+$/.test(nr) && request.method === 'POST') return json(await mesaj(nr, await text(request), env), 201);
  } catch (e) {
    return json({ eroare: e.message }, e.cod ?? 502);
  }
  return json({ eroare: 'Metodă nepermisă.' }, 405);
}

// ---------------------------------------------------------------- GitHub

async function gh(env, cale, init = {}) {
  if (!env.GITHUB_TOKEN_ASISTENT) throw Object.assign(new Error('Lipsește GITHUB_TOKEN_ASISTENT.'), { cod: 503 });
  const r = await fetch(`${GH}${cale}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN_ASISTENT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ferma-sinca9-asistent',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!r.ok) throw Object.assign(new Error(`GitHub a răspuns ${r.status}.`), { cod: 502 });
  return r.status === 204 ? null : r.json();
}

const eAsistent = (autor) => autor?.type === 'Bot' || autor?.login === 'github-actions[bot]';

async function lista(env) {
  const issues = await gh(env, `/issues?labels=${ETICHETA}&state=all&per_page=30&sort=updated`);
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => ({ nr: i.number, titlu: i.title, actualizat: i.updated_at, deschisa: i.state === 'open' }));
}

async function conversatie(nr, env) {
  const [i, comentarii, rulari] = await Promise.all([
    gh(env, `/issues/${nr}`),
    gh(env, `/issues/${nr}/comments?per_page=100`),
    gh(env, `/actions/workflows/asistent.yml/runs?per_page=10`).catch(() => ({ workflow_runs: [] })),
  ]);
  if (!i.labels?.some((l) => l.name === ETICHETA)) throw Object.assign(new Error('Nu e o conversație.'), { cod: 404 });
  const mesaje = [
    { autor: 'eu', ...faraModel(i.body), data: i.created_at },
    ...comentarii.map((c) => ({ autor: eAsistent(c.user) ? 'asistent' : 'eu', ...faraModel(c.body), data: c.updated_at })),
  ];
  const activa = rulari.workflow_runs?.some((r) => r.status !== 'completed' && r.display_title === i.title);
  return {
    nr: i.number,
    titlu: i.title,
    url: i.html_url,
    mesaje,
    // Agentul „lucrează” cât timp ultimul mesaj e al tău și n-a venit răspunsul.
    lucreaza: mesaje.at(-1).autor === 'eu',
    ruleaza: !!activa,
  };
}

async function conversatieNoua({ text: t, model }, env) {
  await gh(env, '/labels', { method: 'POST', body: JSON.stringify({ name: ETICHETA, color: '2c5a4d' }) }).catch(() => {});
  const titlu = t.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 70) || 'Cerere';
  const i = await gh(env, '/issues', { method: 'POST', body: JSON.stringify({ title: titlu, body: cuModel(t, model), labels: [ETICHETA] }) });
  return { nr: i.number };
}

async function mesaj(nr, { text: t, model }, env) {
  await gh(env, `/issues/${nr}/comments`, { method: 'POST', body: JSON.stringify({ body: cuModel(t, model) }) });
  return { ok: true };
}

async function text(request) {
  const corp = await request.json().catch(() => ({}));
  const t = String(corp.text ?? '').trim();
  if (!t) throw Object.assign(new Error('Mesajul e gol.'), { cod: 400 });
  if (t.length > 8000) throw Object.assign(new Error('Mesajul e prea lung.'), { cod: 400 });
  const model = corp.model ?? 'opus';
  if (!MODELE[model]) throw Object.assign(new Error('Model necunoscut.'), { cod: 400 });
  return { text: t, model };
}

// ---------------------------------------------------------------- Cloudflare Access

let certuri = { chei: null, pana: 0 };

async function verificaAcces(request, env) {
  const { ACCESS_TEAM_DOMAIN: echipa, ACCESS_AUD: aud, ASISTENT_EMAIL: email } = env;
  if (!echipa || !aud || !email) return { cod: 503, mesaj: 'Asistentul nu e configurat (Cloudflare Access).' };
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return { cod: 401, mesaj: 'Neautentificat.' };
  try {
    const [h, p, s] = jwt.split('.');
    const antet = JSON.parse(b64text(h));
    const date = JSON.parse(b64text(p));
    const cheie = (await cheiAccess(echipa)).find((k) => k.kid === antet.kid);
    if (!cheie || antet.alg !== 'RS256') throw 0;
    const k = await crypto.subtle.importKey('jwk', cheie, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const bun = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, b64bytes(s), new TextEncoder().encode(`${h}.${p}`));
    const acum = Date.now() / 1000;
    const audiente = Array.isArray(date.aud) ? date.aud : [date.aud];
    if (!bun || date.exp < acum || date.iss !== `https://${echipa}` || !audiente.includes(aud)) throw 0;
    if (String(date.email ?? '').toLowerCase() !== email.toLowerCase()) return { cod: 403, mesaj: 'Nu ai acces la asistent.' };
    return null;
  } catch {
    return { cod: 401, mesaj: 'Autentificare invalidă.' };
  }
}

async function cheiAccess(echipa) {
  if (certuri.chei && certuri.pana > Date.now()) return certuri.chei;
  const r = await fetch(`https://${echipa}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certuri Access indisponibile');
  certuri = { chei: (await r.json()).keys ?? [], pana: Date.now() + 60 * 60 * 1000 };
  return certuri.chei;
}

const b64 = (s) => s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
const b64bytes = (s) => Uint8Array.from(atob(b64(s)), (c) => c.charCodeAt(0));
const b64text = (s) => new TextDecoder().decode(b64bytes(s));

function json(date, status = 200) {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
