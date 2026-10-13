# 🕊️ Overdracht — Duivencompetitie webapp

> Dit bestand bundelt **alles wat je nodig hebt om verder te werken** (ook op een
> nieuwe laptop, of met een nieuwe Claude-sessie). De code zelf zit in deze repo;
> dit document legt de *context* eromheen vast.

_Laatst bijgewerkt: 2026-06-26_

---

## 1. Wat is dit?

Een online tourpoule voor duiven. Deelnemers (vaak duo's) kiezen vooraf duiven;
per echte vlucht leveren die duiven punten op naar aankomstpositie. Iedereen kan
een uitslag invullen door de **laatste 3 cijfers** van elk ringnummer in te typen,
en er rolt een **mooie, openbare tussenstand** uit.

Het verving een handmatige Google Sheet ("Duiven Competitie Automaat") waarin
Sjoerd alles met copy-paste en formules bijhield.

## 2. Architectuur

```
Browser ──► GitHub Pages (deze site) ──► Apps Script Web App ──► Google Sheet
            tussenstand + invoer          GET data / POST uitslag    de database
```

- **Frontend:** plain HTML/CSS/JS, geen build-stap. Draait op GitHub Pages.
- **API:** een Google Apps Script Web App (gratis lijm), gedeployd als "Iedereen".
- **Database:** een Google Sheet met 4 tabbladen. Bron van waarheid.
- **Toegang:** helemaal open (geen wachtwoord). Sheet-versiegeschiedenis = vangnet.

## 3. Belangrijke links & ID's

| Wat | Waarde |
|---|---|
| **Live site (hub, met alle tabs)** | https://sjoerdjebis.github.io/duivencompetitie/ |
| **Deelpagina voor deelnemers** (zonder beheer-tabs) | https://sjoerdjebis.github.io/duivencompetitie/tussenstand.html |
| **Uitslag invoeren** | https://sjoerdjebis.github.io/duivencompetitie/invoer.html |
| **Seizoen voorbereiden** | https://sjoerdjebis.github.io/duivencompetitie/voorbereiden.html |
| **Keuzemoment (draft)** | https://sjoerdjebis.github.io/duivencompetitie/keuzemoment.html |
| **GitHub-repo** (openbaar) | https://github.com/SjoerdjeBis/duivencompetitie |
| **GitHub-account** | SjoerdjeBis |
| **Google Sheet (database)** | "Duivencompetitie 2025 (web)", id `1tgy6qbZ7xvNmDTudVrCem5sMCWlS64R19mLvIhDCp4A` |
| **Apps Script Web App** | URL staat in `config.js` (`API_URL`, eindigt op `/exec`) |
| **Oude bron-Sheet** (alleen referentie, NIET aanraken) | "Duiven Competitie Automaat", id `1oLS5SronWWau40NPBEkwzrj011vNAaUwmV5CkTEnbS8` |

> De Apps Script-URL staat al openbaar in `config.js`; de Sheet zelf is privé
> (alleen toegankelijk via Sjoerds Google-account).

## 4. Verbinden op een nieuwe laptop

1. **Repo ophalen:**
   ```bash
   git clone https://github.com/SjoerdjeBis/duivencompetitie.git
   cd duivencompetitie
   ```
2. **Lokaal bekijken (demo-modus):** als je `API_URL` tijdelijk leegmaakt draait
   alles op de seed-data in `data/`. Anders gebruikt het de live Sheet.
   ```bash
   python3 -m http.server 8765
   # open http://localhost:8765/index.html
   ```
3. **Wijziging live zetten:** committen + `git push`. GitHub Pages publiceert
   automatisch (~1 min). Bij CSS/JS/config-wijzigingen soms harde refresh nodig
   (Cmd+Shift+R) vanwege browser-caching.
4. **Google-toegang:** om de Sheet/Apps Script te beheren moet je ingelogd zijn op
   het Google-account waar de Sheet onder valt.

## 5. De Sheet (datamodel — 4 tabbladen)

- **Duivendatabase**: `naam, ring_lang, ring_kort, teams`
  - `ring_kort` = laatste 3 cijfers, met voorloopnul (bv. `085`).
  - meerdere teams gescheiden door ` | ` (gedeelde duif → beide teams volle punten).
- **Resultaten**: `vlucht, positie, ring_kort, naam_override` — één regel per
  finisher per vlucht. **De enige ruwe invoer**; al het andere wordt berekend.
- **Puntentabel**: `positie, punten` — `50,45,40,37,33,30,28,26,24,22,20,18,16,14,12,10,9,8,7,6,5,4,3,2,1` voor plek 1–25.
- **Deelnemers**: `naam` — zodat ook 0-punters in het klassement staan.

De tussenstand wordt **in code** berekend (`assets/scoring.js`), niet via
sheet-formules.

## 6. Hoe de Apps Script werkt

Het Apps Script-project in de Sheet heeft 2 bestanden:
- **`Code.gs`** (in de repo: `apps-script/Setup.gs`) — eenmalige `setup()` die de
  4 tabbladen bouwt en vult met de seed-data.
- **`Api.gs`** (in de repo: `apps-script/Code.gs`) — de API:
  - `doGet` → JSON met `duiven / resultaten / punten / deelnemers` (`ok:true`).
  - `doPost` → action-router: `saveUitslag` (standaard), `setupSeizoen`
    (voorbereiden-pagina), `kiesDuif` (keuzemoment).

POST gebruikt `Content-Type: text/plain` om CORS-preflight te vermijden; body is
JSON-als-tekst.

## 7. De pagina's

| Pagina | Doel |
|---|---|
| `index.html` | Openbare tussenstand mét nav naar alle beheer-tabs (hub). |
| `tussenstand.html` | Identiek aan index maar **zonder** nav-tabs — link om naar deelnemers te sturen. |
| `invoer.html` | Uitslag invoeren via laatste 3 cijfers; live naam-resolutie + validatie. |
| `voorbereiden.html` | Seizoensstart: deelnemers + duiven klaarzetten. |
| `keuzemoment.html` | De draft: teams kiezen om beurten duiven (omgekeerde eindstand), zelf of willekeurig (glazen kom met eieren-animatie), en geven ze een naam. |

## 8. Status & verificatie

- **Live sinds 2026-06-05.** GET geeft `ok:true` (70 duiven, 225 resultaten,
  20 deelnemers); CORS werkt cross-origin.
- **Scoring matcht exact de oude Sheet:** Marco & Kelsey 316 #1; laatste vlucht
  Lois & Wessel & Romy 82; beste duif Niels 197.
- Alle gemigreerde data is **seizoen 2025**.

## 9. Belangrijke afspraken / constraints

- ⛔ **Blijf van Sjoerds Google Form-bestanden af** (bv. "Tourpoule 2026 -
  Reacties"). Géén koppeling/automatisering met de Form bouwen tenzij Sjoerd er
  **expliciet** om vraagt.
- ⛔ De **oude Sheet** "Duiven Competitie Automaat" niet aanraken — alleen
  referentie.
- 📅 **2026:** er komt een nieuwe database voor seizoen 2026 die Sjoerd en Claude
  **samen** gaan vullen (nieuwe deelnemers + duivenkeuzes). De app-structuur blijft
  gelijk; alleen de data wordt ververst via de Voorbereiden- en Keuzemoment-pagina's.
- ❓ **Deelduiven** (één duif in meerdere teams) als draft-flow is nog niet
  gebouwd; het `teams`-veld ondersteunt het wel (` | `). Pas relevant als 2026 ze
  heeft.

## 10. Werkwijze tijdens het seizoen

1. Iemand voert een uitslag in via `invoer.html` → wordt direct in de Sheet
   opgeslagen → de openbare tussenstand werkt automatisch bij. Geen handmatig
   kopiëren meer.
2. Vergissing? Stuur dezelfde vlucht opnieuw in met `overwrite: true`, of corrigeer
   de regels in het tabblad `Resultaten`. Versiegeschiedenis is het vangnet.

---

_De drie Claude-geheugenbestanden (projectkennis) staan los van deze repo in
`~/.claude/projects/-Users-sjoerdmacoud-Desktop-Duivencompetitie/memory/`. Bij een
nieuwe laptop kopieer je die map mee — zie de exportmap op het bureaublad._
