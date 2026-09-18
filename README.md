# Ferma Șinca 9

Evidența livezii de la Șinca Nouă: planul terenului cu fiecare pom, pagina fiecărui pom (soi, portaltoi, pepinieră, plantare, jurnal pe ani) și etichete QR printabile care duc la pagina pomului.

Astro (site static) + Sveltia CMS (conținutul stă în repo, ca fișiere) + Cloudflare Workers (găzduire + autentificarea în CMS). Fiecare modificare din Admin e un commit; GitHub Actions reface și publică site-ul în 1–2 minute.

## Unde stă conținutul

| Ce | Unde | Se editează din |
|---|---|---|
| Pomii (unul pe fișier) | `src/content/pomi/*.yaml` | Admin → Pomi și arbuști |
| Fișele de soi | `src/content/soiuri/*.yaml` | Admin → Soiuri |
| Fișele de portaltoi | `src/content/portaltoiuri/*.yaml` | Admin → Portaltoiuri |
| Jurnalul | `src/content/jurnal/*.md` | Admin → Jurnal, sau „Adaugă în jurnal” de pe pagina pomului |
| Conturul terenului și zonele | `src/data/teren.yaml` | Admin → Plan și poziții |
| Pozițiile pomilor | `src/data/pozitii.json` | Planul → „Aranjează pe plan” |
| Poze | `public/media/` | Se urcă din Admin (micșorate automat, WebP) |

Specii, stări și tipuri de înregistrări: `src/lib/specii.js` (aceleași liste apar și în Admin).

## Pornire locală

```bash
git init -b main          # întâi git, ca npm install să poată activa hook-ul de gardă
npm install
npm run dev               # http://localhost:4321
```

Admin local: http://localhost:4321/admin/ → „Work with Local Repository” (Chrome/Edge) și alegi folderul proiectului.

## 1. Primul push — doar în contul GitHub PERSONAL

1. În `ferma.config.json` pune la `github.owner` userul tău **personal**.
2. Verifică ce cont folosește `gh` și, dacă e nevoie, schimbă-l:
   ```bash
   gh auth status
   gh auth switch --user <user-personal>
   git config user.email "<email-personal>"     # doar pentru acest repo
   npm run garda                                 # trebuie să iasă „Totul e în regulă.”
   ```
3. Creează repo-ul și urcă:
   ```bash
   git add . && git commit -m "Ferma Șinca 9: prima versiune"
   gh repo create <user-personal>/ferma-sinca9 --public --source . --push
   ```
   Hook-ul `pre-push` blochează push-ul dacă remote-ul nu e exact `<user-personal>/ferma-sinca9` sau conține „fortech” / „aiperion”.

Repo-ul public e suficient (site-ul e oricum public) și permite scope-ul minim `public_repo` la autentificare. Dacă îl faci privat, pune `"GITHUB_SCOPE": "repo"` în `wrangler.jsonc`.

## 2. Cloudflare — contul PERSONAL

1. În dashboard-ul contului personal copiază **Account ID** în `wrangler.jsonc` la `account_id`.
2. My Profile → API Tokens → Create Token → șablonul **Edit Cloudflare Workers**, cu *Account Resources* = doar contul personal.
3. În repo: Settings → Secrets and variables → Actions → adaugă `CLOUDFLARE_API_TOKEN` și `CLOUDFLARE_ACCOUNT_ID`.
4. Push pe `main` → Actions rulează garda, build-ul și `wrangler deploy`. Site-ul apare la `https://ferma-sinca9.<subdomeniu>.workers.dev`.

În CI, garda oprește deploy-ul dacă workflow-ul nu rulează în contul din `ferma.config.json`, dacă ID-ul din secret diferă de cel din `wrangler.jsonc` sau dacă numele contului Cloudflare conține „fortech” / „aiperion”.

## 3. Autentificarea în Admin

Varianta cu buton „Sign in with GitHub”:

1. GitHub (contul personal) → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: adresa site-ului
   - Authorization callback URL: `<adresa-site-ului>/oauth/callback`
2. Pune Client ID-ul în `wrangler.jsonc` la `vars.GITHUB_CLIENT_ID` și fă commit.
3. Secretul, o singură dată:
   ```bash
   npm run garda && npx wrangler secret put GITHUB_CLIENT_SECRET
   ```

O aplicație OAuth are un singur callback: când treci pe domeniul final, actualizează-l.

Varianta fără OAuth: în Admin, „Sign In Using Access Token”, cu un token *fine-grained* limitat la acest repo și permisiunea *Contents: Read and write*. Nu-l lipi nicăieri altundeva.

## 4. Domeniul ferma.sinca9.ro

1. Cumperi **sinca9.ro** de la un registrar .ro și adaugi zona în contul Cloudflare personal (planul Free); la registrar pui nameserverele primite de la Cloudflare. `ferma` e subdomeniu — nu se cumpără separat.
2. În `wrangler.jsonc` decomentezi `routes` (custom domain) și faci push.
3. Actualizezi callback-ul aplicației OAuth la `https://ferma.sinca9.ro/oauth/callback`.

Codurile QR folosesc deja `site.url` din `ferma.config.json` (`https://ferma.sinca9.ro`). **Printează etichetele după ce domeniul răspunde** — scanează întâi una de pe ecran.

## Folosire

**Plan.** Clic pe un pom → fișa scurtă; linkul `/#mar-07` deschide planul direct la pom. „Aranjează pe plan”: alegi un pom din „Nepoziționați” și atingi locul; pomii de pe plan se trag cu degetul/mouse-ul (aliniere la 0,5 m). Dacă doi pomi sunt mai aproape decât suma razelor coroanelor la maturitate (cercurile punctate), apare avertisment. „Salvează” face commit în `src/data/pozitii.json` cu autentificarea din Admin; modificările nesalvate rămân în browser până le salvezi.

**Jurnal.** De pe pagina pomului: „Adaugă în jurnal” (Admin cu pomul deja completat) sau „Marchează plantarea” (tipul plantare; pomul trece automat din „comandat” în „plantat”). O înregistrare poate viza pomi anume, specii întregi („toți perii”) sau toată livada. Recolta și măsurătorile intră în tabelul „Evoluție pe ani” doar când înregistrarea e pentru **un singur pom**.

**Etichete.** `/etichete/` → format (50×25, 70×35 sau 90×45 mm), filtre, Printează (A4). O singură etichetă: `/etichete/?id=mar-07`. Hârtie autocolantă rezistentă la apă sau laminare; prinde eticheta de tutore, nu strâns pe ramură. ID-ul pomului e pe etichetă — nu-l mai schimba după printare.

**Planul terenului.** Acum e o schiță din suprafețele din CF (strada pe latura de vest, nordul sus). Pentru conturul exact: în `src/data/teren.yaml` pune `sistem: stereo70`, iar la fiecare parcelă câte un punct pe linie, `X Y` (X = Nord, Y = Est), exact ca în tabelul din planul cadastral. Stabilește `origine_stereo70` o singură dată, **înainte** de a așeza pomii: pozițiile lor sunt în metri față de acel punct.

## Import din Excel

Pentru o comandă nouă, cu aceleași coloane ca `inventar_final_livada.xlsx`:

```bash
npm run import -- comanda.xlsx                            # arată ce ar crea
npm run import -- comanda.xlsx --scrie --comanda "Primăvara 2027"
```

Rândurile deja importate (același nr. de inventar și același soi) sunt sărite; fișele de soi și portaltoi existente nu se suprascriu.

## Comenzi

| | |
|---|---|
| `npm run dev` | site local + Admin local |
| `npm run build` | build static în `dist/` |
| `npm run preview` | build + Worker local (`wrangler dev`) |
| `npm run garda` | verifică remote-ul git, emailul, contul `gh` și contul `wrangler` |
| `npm run deploy` | garda + build + deploy manual (de obicei o face GitHub Actions) |
