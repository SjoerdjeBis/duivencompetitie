---
name: duivencompetitie-webapp
description: De online webapp-versie van de duivencompetitie (GitHub Pages + Apps Script + Google Sheet)
metadata: 
  node_type: memory
  type: project
  originSessionId: b027dfe3-447c-48ab-a5ca-4c7e55b6d9cd
---

Sjoerd automatiseert de duiven-tourpoule ([[duivencompetitie-systeem]]) tot een online app in /Users/sjoerdmacoud/Desktop/Duivencompetitie (lokale git-repo aangemaakt, nog niet naar GitHub gepusht — dat moet Sjoerd zelf willen/bevestigen).

**Architectuur (door Sjoerd gekozen):** bron blijft Google Sheets; invoer is helemaal open (geen wachtwoord). Statische site op GitHub Pages → Apps Script Web App (GET data / POST uitslag) → Google Sheet als database.

**Bestanden:** index.html (openbare tussenstand), invoer.html (uitslag via laatste 3 cijfers ringnummer), voorbereiden.html (seizoensstart: deelnemers + duiven klaarzetten), config.js (enige in te vullen bestand: API_URL + titel + AANTAL_POSITIES), assets/scoring.js (gedeelde reken-/datalogica, framework-vrij; model heeft nu ook .deelnemers), assets/api.js (live vs demo-modus; submitUitslag + saveSeizoen via postJSON), assets/{tussenstand,invoer,voorbereiden}.js, assets/styles.css, assets/logo.png. apps-script/Setup.gs (één-klik: bouwt 4 tabbladen + vult gemigreerde data), apps-script/Code.gs (de API). data/*.csv = gemigreerde seed. Nav op alle pagina's: Tussenstand · Uitslag invoeren · Voorbereiden · Keuzemoment. EXTRA: tussenstand.html = publieke deelpagina, identiek aan index.html maar ZONDER nav-tabs (om naar deelnemers te sturen); gebruikt dezelfde tussenstand.js.

**Keuzemoment-pagina (de draft, keuzemoment.html + assets/keuzemoment.js):** teams kiezen om beurten duiven in OMGEKEERDE eindstand van vorig jaar (slechtste eerst; volgorde aanpasbaar met ▲▼ op opzet-scherm). Eén doorloop: elk team kiest zijn hele beurt in één keer; richtgetal DUIVEN_PER_TEAM (config.js, default 8), maar 'Team klaar' kan eerder/later. Per beurt één methode: ZELF (grid van beschikbare korte nummers → klik → naam-modal) of WILLEKEURIG (glazen kom met ~26 eieren in ellips; knop 'Kies een nummer' → duif 🕊️ vliegt in, dipt in kom, tilt vlieg-ei op, laat het vallen (zwaartekracht-easing), ei barst in 2 dop-helften + vonken → nummerkaart ploft tevoorschijn → naam-modal). Web Animations API met async/await. Elke keuze: live → API.kiesDuif (zet naam+team op duif via ring_lang), demo → in-memory + kopieerknop aan eind (TSV naam/lang/kort/team). Demo start 'vers' (alle 70 duiven beschikbaar) om te oefenen; live gebruikt duiven met leeg teams-veld als pool (resume mogelijk). Eindscherm: overzicht per team. Code.gs action-router heeft nu ook 'kiesDuif'. GETEST in demo: volgorde klopt (Roy & Maureen eerst), beide methodes, animatie + onthulling, eindscherm. Deelduiven (duif in meerdere teams) nog niet als draft-flow gebouwd — Sjoerd weet pas later of die er zijn; teams-veld ondersteunt het wel (' | ').

**Voorbereiden-pagina (seizoensstart):** deelnemers van vorig jaar staan alfabetisch + aangevinkt klaar (vinkje uit = stopt, naam editen = naamswijziging, + nieuwe toevoegen). Duiven: plak lange ringnummers in textarea → live preview-chips met auto-afgeleide korte code (laatste 3 cijfers), botsende korte codes rood gemarkeerd + waarschuwing. Opslaan = API.saveSeizoen → Code.gs setupSeizoen vervangt tabbladen Deelnemers + Duivendatabase (duiven met lege naam/teams; namen/teams volgen op het KEUZEMOMENT — aparte opdracht die nog komt). Optie 'wisUitslagen' wist ook Resultaten. Demo-modus: opslaan uit, wel kopieerknoppen (deelnemers als regels, duiven als TSV) voor handmatig plakken in de Sheet. Code.gs doPost is nu een action-router (uitslag | setupSeizoen).

**Datamodel (Sheet-tabbladen):** Duivendatabase (naam, ring_lang, ring_kort=laatste 3 cijfers met voorloopnul, teams gescheiden door ' | '), Resultaten (vlucht, positie, ring_kort, naam_override — enige ruwe invoer), Puntentabel (positie, punten), Deelnemers (naam). Tussenstand wordt in code berekend, niet meer via sheet-formules.

**Geverifieerd:** scoring matcht exact de oude Sheet (Marco & Kelsey 316 #1, laatste vlucht Lois & Wessel & Romy 82, beste duif Niels 197). Live-loop (invoer→API→tussenstand) end-to-end getest met mock-API. Randgevallen werken: botsende 3-cijfercodes, onbekende ring (reserve), duplicaten.

**Data-opschoning gedaan:** teamnamen genormaliseerd (Niek & Wieteke→Niek & Wiet, Tessa & Gilles→Gilles & Tessa); ring_kort genormaliseerd naar echte laatste 3 cijfers (085-088 i.p.v. 85-88 voor de 1587-serie).

**Seizoen:** alle gemigreerde deelnemers/duiven/uitslagen zijn van **seizoen 2025** (config.js titel = "Duivencompetitie 2025"). Er komt straks een **nieuwe database voor 2026** die Sjoerd en ik **samen** gaan vullen (nieuwe deelnemers + duivenkeuzes). De app-structuur blijft gelijk; alleen de data wordt ververst.

**BELANGRIJK — niet aanraken:** afblijven van Sjoerds Google Form-bestanden (bv. "Tourpoule 2026 - Reacties"). Géén koppeling/automatisering met de Form bouwen tenzij Sjoerd er expliciet om vraagt.

**Logo:** het clublogo "Een goed stel duifjes" (zwart-wit rond, duif + sterren) staat in assets/logo.png (352x352, uit de originele Sheet gehaald). Verwerkt als ronde badge in de header van index.html én invoer.html, en als favicon. CSS: header.app .logo = 52px ronde witte badge met img object-fit cover.

**LIVE (uitgerold op 2026-06-05):**
- GitHub repo (openbaar, account SjoerdjeBis): https://github.com/SjoerdjeBis/duivencompetitie — remote origin, branch main.
- Live site (GitHub Pages): https://sjoerdjebis.github.io/duivencompetitie/ — index = hub met nav; tussenstand.html = deelpagina voor deelnemers; ook invoer/voorbereiden/keuzemoment.html.
- Nieuwe Google Sheet "Duivencompetitie 2025 (web)", id 1tgy6qbZ7xvNmDTudVrCem5sMCWlS64R19mLvIhDCp4A (los van de oude "Duiven Competitie Automaat"). Apps Script-project erin heeft 2 bestanden: Code.gs (de Setup-seed + setup()) en Api.gs (de API doGet/doPost). Gedeployd als Web App, toegang "Iedereen".
- API_URL staat in config.js (gecommit): .../macros/s/AKfycbyVlL3TGQX2IY3yBG4v5RD4w7bQmfqx3cazGVSm60Ei1yndms0WEvyIfm-fAnYP7Dliyw/exec
- Geverifieerd live: GET geeft ok:true (70 duiven, 225 resultaten, 20 deelnemers), CORS werkt cross-origin, site toont "Live"-banner met echte stand (Marco & Kelsey 316 #1).
- NB caching: bij wijzigingen aan config.js/css/js kan de browser oud cachen → harde refresh (Cmd+Shift+R). Overwegen: cache-bust query op asset-links.
- Gemaakt via Claude in Chrome (browser-automatisering); de OAuth-grant bleek niet nodig (account al geautoriseerd), de "Iedereen"-toegang + deploy heeft Sjoerd zelf geklikt.
