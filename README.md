# 🕊️ Duivencompetitie

Een online tourpoule voor duiven: deelnemers kiezen vooraf duiven, en per echte
vlucht leveren die duiven punten op naar aankomstpositie. Iedereen kan een uitslag
invullen door de **laatste 3 cijfers** van elk ringnummer in te typen, en er rolt
een **mooie, openbare tussenstand** uit.

- **Tussenstand** (openbaar): `index.html`
- **Uitslag invoeren**: `invoer.html`

De site is volledig statisch (draait op **GitHub Pages**, geen build-stap). De
**Google Sheet** blijft de database; een klein **Apps Script** is de gratis lijm
die lezen/schrijven mogelijk maakt.

```
Browser ──► GitHub Pages (deze site) ──► Apps Script Web App ──► Google Sheet
            tussenstand + invoer          GET data / POST uitslag    de database
```

## Mappenstructuur

| Pad | Wat |
|---|---|
| `index.html` / `invoer.html` | De twee pagina's |
| `config.js` | **Het enige bestand dat je invult** (API-URL, titel) |
| `assets/scoring.js` | Reken-/datalogica (gedeeld door live én demo) |
| `assets/api.js` | Laadt data / verstuurt uitslagen |
| `assets/tussenstand.js`, `assets/invoer.js` | De twee pagina's |
| `assets/styles.css` | Vormgeving |
| `data/*.csv` | Gemigreerde seed-data (duiven, resultaten, punten, deelnemers) |
| `apps-script/Setup.gs` | Eénmalig: bouwt de Sheet-tabbladen + vult ze met je data |
| `apps-script/Code.gs` | De Web App (API) |

## Even lokaal bekijken (demo-modus)

Zolang `config.js` geen `API_URL` heeft, draait alles in **demo-modus** op de
gebundelde data in `data/`. Start een lokale server in deze map:

```bash
python3 -m http.server 8765
# open http://localhost:8765/index.html
```

## Live zetten — 3 stappen

### 1. Google Sheet inrichten
1. Maak een **nieuwe** (lege) Google Sheet.
2. Ga naar **Extensies → Apps Script**, plak de inhoud van `apps-script/Setup.gs`,
   kies bovenin de functie **`setup`** en klik **Uitvoeren** (geef toestemming).
   → Je krijgt vier tabbladen: `Duivendatabase`, `Resultaten`, `Puntentabel`,
   `Deelnemers`, gevuld met je gemigreerde data.

### 2. De API (Web App) deployen
1. Voeg in datzelfde Apps Script-project de inhoud van `apps-script/Code.gs` toe
   (nieuw scriptbestand).
2. **Implementeren → Nieuwe implementatie → type: Web-app**.
   - *Uitvoeren als:* **ikzelf**
   - *Wie heeft toegang:* **Iedereen**
3. Kopieer de **Web App-URL** (eindigt op `/exec`).

### 3. Site koppelen en publiceren
1. Zet de URL in `config.js` bij `API_URL`.
2. Push deze map naar een GitHub-repo en zet **Settings → Pages → Deploy from
   branch → `main` / root** aan.
3. Klaar: de tussenstand staat openbaar online en iedereen kan uitslagen invoeren.

## Een uitslag invoeren

Op `invoer.html`: vul het vluchtnummer in (wordt automatisch voorgesteld) en typ
per aankomstplek de **laatste 3 cijfers** van het ringnummer. De naam + team
verschijnen direct ter controle. Bijzonderheden worden afgevangen:

- **Onbekend ringnummer** → je kunt er een naam bij typen (bv. een reserve-duif).
- **Twee duiven met dezelfde 3 cijfers** → je kiest welke je bedoelt.
- **Dubbel ingevoerd** → wordt rood gemarkeerd en blokkeert verzenden.

## Datamodel

- **Duivendatabase**: `naam, ring_lang, ring_kort, teams`
  (`ring_kort` = laatste 3 cijfers; meerdere teams gescheiden door ` | `).
- **Resultaten**: `vlucht, positie, ring_kort, naam_override` — één regel per
  finisher per vlucht. Dit is de enige ruwe invoer; al het andere wordt berekend.
- **Puntentabel**: `positie, punten` (50, 45, 40, 37, 33, … 1 voor plek 1–25).
- **Deelnemers**: `naam` — zodat ook 0-punters in het klassement staan.

## Onderhoud

- **Nieuwe duif / nieuw seizoen**: voeg rijen toe in het tabblad `Duivendatabase`.
- **Puntenschaal aanpassen**: wijzig `Puntentabel`.
- **Vergissing in een uitslag**: stuur dezelfde vlucht opnieuw in met
  `overwrite: true`, of corrigeer de regels in het tabblad `Resultaten`.
  De Sheet-versiegeschiedenis is altijd je vangnet.
