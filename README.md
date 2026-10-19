# 🕊️ Duivencompetitie

Een online tourpoule voor duiven van **Een Goed Stel Duifjes**. Teams kiezen vooraf
duiven; per echte vlucht leveren die duiven punten op naar aankomstpositie. Een
uitslag invoeren gaat met de **laatste 3 cijfers** van elk ringnummer, en er rolt een
openbare tussenstand uit.

- **Live site:** https://sjoerdjebis.github.io/duivencompetitie/ (beheer-startpagina)
- **Openbare tussenstand** (deellink): https://sjoerdjebis.github.io/duivencompetitie/tussenstandopen.html

```
Browser ──► GitHub Pages (deze site) ──► Apps Script Web App ──► Google Sheet
            statische HTML/CSS/JS          GET data / POST acties     de database
```

De site is volledig statisch (geen build-stap). De **Google Sheet** "Duivencompetitie
database elk jaar" is de database en blijft elk jaar dezelfde; een seizoen wordt
gearchiveerd als kopie. Het **Apps Script-project "DASN"** (gekoppeld aan die Sheet)
is de API. Alle standen worden in de browser berekend (`assets/scoring.js`).

## Pagina's

| Pagina | Doel |
|---|---|
| `index.html` | Beheer-startpagina: seizoensstatus + volgende stap, tegels naar alles |
| `voorbereiden.html` | Seizoenswissel als stappenplan (zie hieronder) |
| `keuzemoment.html` | Zonder `?team=`: per team een keuzelink. Met `?team=<slug>`: dat team kiest zelf of willekeurig (eieren-animatie) en geeft namen |
| `deelnemers.html` | Duiven per team met punten per etappe; naam wijzigen / uit team halen |
| `duivenlijst.html` | Alle duiven in één sorteerbare tabel |
| `invoer.html` | Uitslag invoeren (ook in delen); ingevoerde etappes wijzigen of verwijderen |
| `overig.html` | Deellinks (tussenstand, orakel, In Memoriam) + Sheet, archief, Apps Script, GitHub |
| `tussenstandopen.html` | **Openbaar**, zonder menu: duiven vandaag, dagscore, klassement, beste duiven, teams. Toont direct de laatst bekende stand en ververst elke 3 minuten |
| `orakel.html` | Koeroe, het Duiven-Orakel (voorspellingen 2026) |
| `inmemoriam.html` | De Gevallen Vliegers (13 juli 2026) |

## Bestanden

| Pad | Wat |
|---|---|
| `config.js` | `API_URL` (de /exec-URL), terugval-titel, aantal posities |
| `assets/api.js` | Data laden (met bewaarde kopie voor direct beeld), POST-acties, beheercode-venster + slotje |
| `assets/scoring.js` | Rekenlogica: model, klassement, punten per duif/etappe |
| `assets/<pagina>.js`, `assets/start.js` | Logica per pagina |
| `assets/styles.css` | Vormgeving |
| `apps-script/Code.gs` | De API — het **enige** bestand in het Apps Script-project |
| `manifest.webmanifest` | "Zet op beginscherm" voor de tussenstand |

## Seizoenswissel (Voorbereiden)

Werk de stappen van boven naar beneden af; elke stap toont ✓ klaar, aan de beurt, of
grijs (nog niet aan de beurt).

**A · Seizoen afsluiten** (zolang er uitslagen zijn)
1. **Archiveer dit seizoen** — kopie van de hele Sheet in Drive, of leg de link van
   een eigen kopie vast.
2. **Leeg de database, bewaar de teamnamen** — wist uitslagen en duiven; teams,
   puntentabel en instellingen blijven. Seizoen gaat naar het nieuwe jaartal.

**B · Nieuw seizoen klaarzetten**
3. **Duifnummers** — lange ringnummers plakken; opnieuw opslaan is veilig.
4. **Teamnamen** — vinkje uit = stopt; naamswijziging gaat mee naar de duiven.
5. **Aantal duiven per team** — het maximum op het keuzemoment.
6. **Keuzemoment** — deel de teamlinks.

Onder *Noodknoppen*: alle duiven teamloos maken (keuzemoment overdoen).

## Beheercode

Lezen is openbaar; **opslaan vraagt de beheercode** (Apps Script › Projectinstellingen
› Scripteigenschappen › `BEHEER_CODE`). Een beheerpagina vraagt er op een nieuw
apparaat om, controleert hem en onthoudt hem in die browser. Rechtsboven: 🔒 nog
invullen, 🔓 ontgrendeld (klik = vergeten).

Uitzondering: een team dat via zijn eigen keuzelink een **vrije** duif kiest, heeft
geen code nodig. De server accepteert dat alleen voor teams die op de deelnemerslijst
staan, en namen zijn maximaal 40 tekens.

## Datamodel (tabbladen in de Sheet)

- **Duivendatabase**: `naam, ring_lang, ring_kort, teams` — `ring_kort` = laatste 3
  cijfers met voorloopnul; meerdere teams gescheiden door ` | ` (deelduif: beide
  teams krijgen de volle punten).
- **Resultaten**: `vlucht, positie, ring_kort, naam_override` — de enige ruwe invoer.
  Bij twee duiven met dezelfde 3 cijfers staat in `naam_override` het lange
  ringnummer van de juiste duif; bij een onbekende (reserve)duif een naam.
- **Puntentabel**: `positie, punten` — 50, 45, 40, 37, 33, 30, 28, 26, 24, 22, 20, 18,
  16, 14, 12, 10, 9 … 1 voor plek 1–25.
- **Deelnemers**: `naam` — de teams (ook 0-punters staan zo in het klassement).
- **Instellingen**: `sleutel, waarde` — `seizoen`, `duivenPerTeam`, `archief_<jaar>`.

Een duif wordt overal herkend aan zijn **lange ringnummer**; dubbele namen kunnen dus
geen punten verwisselen.

## Wijzigingen live zetten

- **Site:** committen + `git push`; GitHub Pages publiceert binnen ~1 minuut. Hoog bij
  elke CSS/JS-wijziging het `?v=N`-nummer op in de `.html`-bestanden (cache).
- **API:** plak `apps-script/Code.gs` in Code.gs van project DASN → opslaan →
  Implementeren → **Implementaties beheren** → potlood → Versie: *Nieuwe versie* →
  Implementeren. (Niet "Nieuwe implementatie": dan verandert de URL.)

## Lokaal testen

Er is geen demo-modus meer: de site praat altijd met de API uit `config.js`. Om te
testen zonder de echte Sheet te raken, draai `Code.gs` in Node met een nagebootste
Sheet en wijs `API_URL` daarheen (zo is alles hier ook getest).

## Afspraken

- Blijf van de Google Form-bestanden af (bv. "Tourpoule 2026 - Reacties"); geen
  koppeling met de Form tenzij daar expliciet om gevraagd wordt.
- De oude Sheet "Duiven Competitie Automaat" niet aanraken (alleen referentie).
- Archieven, exports en spreadsheets met persoonlijke gegevens horen niet in deze
  (openbare) repo; zie `.gitignore`.
