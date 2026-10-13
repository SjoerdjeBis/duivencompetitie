---
name: duivencompetitie-systeem
description: "Hoe de \"Duiven Competitie Automaat\" Google Sheet werkt (tourpoule met duiven)"
metadata: 
  node_type: memory
  type: project
  originSessionId: b027dfe3-447c-48ab-a5ca-4c7e55b6d9cd
---

Sjoerd houdt een duiven-tourpoule bij in een Google Spreadsheet ("Duiven Competitie Automaat", id 1oLS5SronWWau40NPBEkwzrj011vNAaUwmV5CkTEnbS8). De sheet is privé; benaderen kan via de ingelogde Chrome-browser (Claude in Chrome) + gviz CSV-export per tabblad.

**Opzet:** elke deelnemer (vaak een duo) kiest vooraf max 8 duiven, vast voor het hele seizoen. Elke duif heeft een ringnummer + naam. Per echte vlucht leveren duiven punten op naar aankomstpositie.

**Puntenschaal positie 1→25:** 50,45,40,37,33,30,28,26,24,22,20,18,16,14,12,10,9,8,7,6,5,4,3,2,1.

**5 tabbladen:**
1. Uitslag laatste vlucht — invoer: ringnummers in aankomstvolgorde; naam+team auto-opgezocht.
2. Uitslagen alle vluchten — per vlucht (Vlucht 1..N) de aankomstvolgorde + puntentabel.
3. Duivenlijst — masterlijst: ringnr, naam, team(s), punten per vlucht, totaal per duif.
4. Lijst per deelnemer — blok per deelnemer met gekozen duiven, punten per vlucht, totaalscore.
5. Tussenstand — totaalscore per deelnemer, algemeen klassement (gesorteerd), score afgelopen vlucht.

**Workflow:** Sjoerd plakt aankomstvolgorde in "Uitslag laatste vlucht", kopieert naar nieuwe kolom in "Uitslagen alle vluchten"; vandaar rekent alles automatisch door.

**Bijzonderheden:** een duif kan aan meerdere deelnemers toebehoren (team "A | B") — dan krijgen beiden de volle punten (dit jaar zo, niet elk jaar). "Reserve Duif 1-5" = duiven in de echte uitslag die niemand koos. Stand nu: 9 vluchten gereden, Marco & Kelsey 1e (316).
