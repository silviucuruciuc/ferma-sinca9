// Worker-ul site-ului: servește fișierele statice și face autentificarea GitHub pentru Sveltia CMS.
// Protocolul e cel din Decap/Netlify CMS: popup -> /oauth/auth -> GitHub -> /oauth/callback -> postMessage.
// Secrete (wrangler secret put): GITHUB_CLIENT_SECRET. Variabile (wrangler.jsonc): GITHUB_CLIENT_ID, GITHUB_SCOPE.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/oauth/auth') return autentificare(url, env);
    if (url.pathname === '/oauth/callback') return intoarcere(request, url, env);
    return env.ASSETS.fetch(request);
  },
};

function autentificare(url, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return raspuns(url.origin, { error: 'OAuth nu e configurat: lipsesc GITHUB_CLIENT_ID sau GITHUB_CLIENT_SECRET.' });
  }
  if ((url.searchParams.get('provider') ?? 'github') !== 'github') {
    return raspuns(url.origin, { error: 'Doar GitHub e suportat.' });
  }
  const stare = crypto.randomUUID().replaceAll('-', '');
  const parametri = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/oauth/callback`,
    scope: env.GITHUB_SCOPE || 'public_repo',
    state: stare,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${parametri}`,
      'Set-Cookie': `oauth_stare=${stare}; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}

async function intoarcere(request, url, env) {
  const cod = url.searchParams.get('code');
  const stare = url.searchParams.get('state');
  const cookie = /(?:^|;\s*)oauth_stare=([a-f0-9]+)/.exec(request.headers.get('Cookie') ?? '')?.[1];
  if (!cod || !stare || stare !== cookie) {
    return raspuns(url.origin, { error: 'Sesiune de autentificare expirată sau invalidă. Încearcă din nou.' });
  }
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'ferma-sinca90-oauth' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: cod,
      redirect_uri: `${url.origin}/oauth/callback`,
    }),
  });
  const date = await r.json().catch(() => ({}));
  if (!date.access_token) {
    return raspuns(url.origin, { error: date.error_description || 'GitHub nu a întors un token.' });
  }
  return raspuns(url.origin, { token: date.access_token });
}

// Trimite rezultatul DOAR către fereastra CMS de pe același domeniu (nu „*”).
function raspuns(origine, continut) {
  const stare = continut.error ? 'error' : 'success';
  const mesaj = `authorization:github:${stare}:${JSON.stringify({ provider: 'github', ...continut })}`;
  const html = `<!doctype html><meta charset="utf-8"><title>Autentificare</title>
<p>${continut.error ? 'Autentificarea a eșuat. Poți închide fereastra.' : 'Gata. Fereastra se închide singură.'}</p>
<script>
(() => {
  const origine = ${JSON.stringify(origine)};
  const mesaj = ${JSON.stringify(mesaj)};
  window.addEventListener('message', (e) => {
    if (e.origin !== origine || e.data !== 'authorizing:github') return;
    window.opener && window.opener.postMessage(mesaj, origine);
  });
  window.opener && window.opener.postMessage('authorizing:github', origine);
})();
</script>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'oauth_stare=; Path=/oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
