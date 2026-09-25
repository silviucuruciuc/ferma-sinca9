# Note pentru Claude — Ferma Șinca 9

`README.md` explică proiectul pentru om. Fișierul ăsta ține minte ce nu se vede din cod:
capcanele în care s-a intrat deja, deciziile luate și motivul lor, și ce a rămas de făcut.

> **Verifică întâi `git status`.** La închiderea sesiunii din 20 sep, `src/data/pozitii.json`
> avea modificări **necommitate**: cei 3 pomi noi puși pe plan (`cais-03`, `nectarin-02`,
> `piersic-01`), 7 scoși de pe plan (`afin-01`, `agris-01`, `amelanchier-01`, `mar-03`,
> `mosmon-01`, `par-10`, `par-16`) și 2 mutați ușor (`mar-24`, `visin-03`). Dacă sunt încă
> acolo, întreabă înainte să le commiți — scoaterea celor 7 poate fi intenționată sau nu.

## Unde e ce

| | |
|---|---|
| Folder | `~/Work/ferma-sinca9` (a fost `ferma-sinca90` până la redenumire) |
| Repo | `silviucuruciuc/ferma-sinca9` — **public** |
| Site | https://ferma.sinca9.ro (custom domain pe Cloudflare Workers) |
| Worker | `ferma-sinca9`. Cel vechi, `ferma-sinca90`, poate încă exista în dashboard — de șters manual |

`cadastru/` e în `.gitignore` și **trebuie să rămână acolo**: conține extrasele CF cu date
personale, iar repo-ul e public. Orice document nou de genul ăsta merge tot acolo.

## Node: prima capcană

Node-ul implicit al shell-ului e **v16.20.2**, dar proiectul cere ≥22.12. Prefixează orice
comandă npm/node:

```bash
PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH" npm run build
```

`npm install` sub Node 16 **reușește**, dar instalează binding-uri native greșite pentru
rolldown, iar build-ul crapă cu `Cannot find module './rolldown-binding.wasi.cjs'`. Dacă vezi
asta: `rm -rf node_modules` și reinstalează sub Node 22.

## Deploy-ul e roșu și asta e normal (deocamdată)

Fiecare push dă `failure` în Actions, dar **site-ul se actualizează oricum**. Motivul:

```
Uploaded ferma-sinca9 (3.4 sec)
✘ A request to the Cloudflare API (/zones/<id>/workers/routes) failed.
  Authentication error [code: 10000]
```

Worker-ul se încarcă, apoi wrangler încearcă să citească rutele zonei și e respins.
Token-ului Cloudflare îi lipsește **Zone → Workers Routes: Read** pe zona `sinca9.ro`.

Deci: **nu te baza pe culoarea rulării.** Verifică direct ce e live:

```bash
curl -sS https://ferma.sinca9.ro/ | grep -o 'class="pom"' | wc -l
```

Când se repară token-ul, pipeline-ul devine verde și atunci roșul redevine semnal real.

**Un token per proiect.** Pe 18 sep a fost creat/rotit token-ul Cloudflare pentru ferma, iar
pe 20 sep blogul mamei (`~/blog-mama`, Cloudflare Pages) a început să pice cu același `9109`,
la două zile după. Rotirea unui token partajat rupe tăcut celelalte proiecte, iar simptomul
apare abia la următorul deploy. Blogul are acum token propriu; ferma încă nu și-l are reparat.
Notă: Pages cere `Cloudflare Pages: Edit`, altă permisiune decât Workers.

Garda (`scripts/garda.mjs`) verifică numele contului Cloudflare prin API doar dacă token-ul
are și **Account Settings: Read**. Fără ea scrie „Numele contului nu poate fi citit" și trece
mai departe — un avertisment, nu o eroare. Contul corect e cel personal, pe gmail.

## Modelul de date — ce te mușcă

**`src/data/teren.yaml` e în Stereo 70.** `X = Nord`, `Y = Est`, un punct pe linie.
Conturul e exact, luat din Anexa 1 la Partea I pentru CF 105881 și CF 105882; ariile
recalculate din coordonate ies `1199.510` și `1000.112` mp, identice cu actele. Cele două
parcele se afișează ca un contur unic — hotarul dintre ele nu se mai desenează.

**`origine_stereo70` nu se schimbă niciodată** după ce s-au așezat pomii: pozițiile din
`pozitii.json` sunt metri față de ea și s-ar deplasa toate.

**Terenul e rotit ~12,6°** față de axele N/E. Orice construcție se aliniază la garduri, nu la
nord — altfel iese strâmbă față de gard. Gardul estic (`202-201-210`) e drept pe toată
lungimea (segmentele diferă cu 0,01°), azimut 22,66°.

**Spalierele** (`spaliere:` în teren.yaml) își calculează singure pozițiile pomilor. Regula:

```
lungime = 2 × margine_m + (nr. pomi − 1) × distanta_m
```

Punctele dau doar startul și direcția; linia se întinde sau se scurtează la lungimea
rezultată. Pomii de pe spalier **nu** apar în `pozitii.json`, nu se pot trage cu mouse-ul și
nu apar la „Nepoziționați". Fără `distanta_m`, se revine la comportamentul vechi (împarte
linia desenată în pași egali).

**Tipurile de zonă trebuie ținute sincronizate în două locuri**: valorile folosite în
`teren.yaml` și lista `options` din `src/pages/admin/config.yml.ts`. S-a introdus deja un bug
aici — `poarta` și `compost` lipseau din Admin, iar o editare de zonă le-ar fi pierdut.

**Un pom nou aduce uneori o specie nouă.** `magnolie` a fost adăugată în `specii.js` pentru
Magnolia Susan; `piersic` era definit de mult, dar fără niciun pom. Înainte să creezi un pom,
verifică dacă specia există — altfel pică la validare.

**YAML: `note:` cu două puncte în text trebuie ghilimetat.** `note: Exista pe teren. De
completat: portaltoiul` pică build-ul cu „bad indentation of a mapping entry", pentru că „: "
deschide o mapare. Pune ghilimele.

**Coroanele pomilor vechi sunt estimate, nu măsurate** (6 m la meri și păr, 4,5 m la pruni).
De aici vin cele ~9 avertismente de suprapunere din plan. Toate implică cel puțin un pom
vechi. Nu sunt o problemă de așezare — dispar când se măsoară pe teren.

## Obiceiuri de verificare care au prins erori reale

Nu sări peste astea, fiecare a prins ceva în sesiunea trecută:

- **Recalculează geometria față de sursă.** Ariile și perimetrele din coordonate trebuie să
  iasă identice cu actele. Așa s-a confirmat că tabelul cadastral a fost citit corect.
- **Verifică explicit semnul normalelor.** Perpendiculara „spre interior" a ieșit inversată de
  două ori și a aruncat construcții în afara terenului. Testeaz-o cu un punct din mijlocul
  parcelei înainte s-o folosești.
- **Distanța fără semn nu știe de ce parte ești.** O căutare pe direcție a trecut de gard și a
  mers până la limita buclei, pentru că distanța creștea iar. Folosește distanță cu semn.
- **`point-in-polygon` dă fals pentru punctele exact pe hotar.** Dacă un colț „iese", măsoară
  distanța la muchii înainte să crezi rezultatul.
- **`grep -c` numără linii, nu apariții** — HTML-ul construit e pe o singură linie. Folosește
  `grep -o ... | wc -l`. Și Astro inserează `data-astro-cid-*` între atribut și `>`, deci
  `grep 'data-stare="vechi">'` nu prinde nimic.
- **`requestAnimationFrame` nu rulează în taburile din fundal.** Planul își desenează tava în
  rAF, deci într-un tab de automatizare pare gol. Nu e bug — adu tabul în față.

## Ce a rămas de făcut

1. **Token Cloudflare**: adaugă `Zone → Workers Routes: Read` (și `Account Settings: Read`
   pentru verificarea de cont din gardă). Până atunci pipeline-ul e roșu permanent.
2. **Fișele de soi** — cel mai mare rest. Sunt 87 de soiuri; 10 au date complete.
   Cartografierea pe surse, dedusă din starea pomilor:

   | sursă | soiuri | gata |
   |---|---|---|
   | Pepinierele Roman (comandați) | 46 | 4 |
   | Sweet Garden (arbuști, ornamentali, exotice) | 18 | 0 |
   | Yurta (pomii plantați) | 13 | 6 |
   | fără sursă — pomii vechi | 8 | — |
   | fără sursă — `nectarin-necunoscut` (nefolosit), `smochin-bucureasa` (nume dat de noi) | 2 | — |

   Paginile Yurta dau uneori **403** la citire automată; atunci ia datele din mai multe
   pepiniere românești care spun același lucru și treci asta ca sursă. Verifică specia înainte
   de orice: „Harco" e nectarin, „Harcot" e cais — nume aproape identice, specii diferite.

   Câmpurile de completat: `origine`, `rezistenta`, `rodire`, `recoltare`, `pastrare`, `gust`,
   `sursa`, plus `evaluare` (note 1-5). **Nu inventa nimic**: notele sunt citirea descrierii
   pepinierei, iar câmpul lipsă se afișează „necunoscut", nu ca notă mică. Cei 10 fără sursă
   rămân goi — sunt pomi vechi cu soiuri necunoscute.
3. **Măsoară coroanele pomilor vechi** și înlocuiește estimările; avertismentele de
   suprapunere dispar atunci.
4. **Pozițiile pe plan.** Sunt 91 de pomi. 50 au fost așezați automat, cu poziție-țintă după
   talie (coroană mare spre gardul de nord, coroană mică spre sud, la soare) — un punct de
   plecare, nu o sentință. La ultima verificare 9 erau nepoziționați, dar vezi avertismentul
   de la începutul fișierului: fișierul de poziții avea modificări necommitate.
5. **OAuth pentru Admin** nu e pus: `GITHUB_CLIENT_ID` e gol în `wrangler.jsonc`. Callback-ul
   trebuie să fie `https://ferma.sinca9.ro/oauth/callback`. Până atunci, intrarea în Admin se
   face cu „Sign In Using Access Token".
6. **Worker-ul vechi `ferma-sinca90`** poate fi încă live în Cloudflare — de șters manual.

## Convenții

- **Româna peste tot**, cu diacritice: cod, comentarii, commit-uri, interfață.
- **Commit-urile explică de ce**, nu ce. Dacă o decizie a avut o alternativă respinsă, scrie
  motivul — mare parte din fișierul ăsta vine din mesaje de commit.
- **Nu inventa date horticole.** Origine, rezistență, perioade — toate vin dintr-o sursă
  verificabilă, altfel rămân goale.
- **Culorile de status** (`--alerta`, `--atentie`, `--bine`) sunt rezervate stării pomului.
  Nu le refolosi pentru altceva; o scară de mărime (ex. notele 1-5) folosește un singur ton.
- **Verifică live după push**, nu te opri la „am dat push".
