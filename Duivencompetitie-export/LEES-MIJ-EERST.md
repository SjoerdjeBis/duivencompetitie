# 📦 Overdracht Duivencompetitie — nieuwe laptop

Deze map bevat alles om op een nieuwe laptop verder te werken aan de
duivencompetitie-webapp.

## Wat zit hierin?

| Bestand/map | Wat |
|---|---|
| `OVERDRACHT.md` | **Lees dit.** Alle context: links, ID's, datamodel, afspraken, hoe verder. |
| `claude-memory/` | De 3 Claude-geheugenbestanden (projectkennis uit eerdere sessies). |

## De code zelf

De code staat **niet** in deze map — die zit veilig op GitHub:

```bash
git clone https://github.com/SjoerdjeBis/duivencompetitie.git
```

Op de nieuwe laptop heb je `git` nodig (en `gh` als je via GitHub CLI wilt
inloggen).

## Claude-geheugen herstellen op de nieuwe laptop

Zodat een nieuwe Claude-sessie de projectkennis weer "kent", kopieer je
`claude-memory/` naar de juiste plek. Het pad hangt af van waar je het project
neerzet. Als je het weer op het bureaublad in een map `Duivencompetitie` zet:

```bash
DEST=~/.claude/projects/-Users-<JOUW-GEBRUIKERSNAAM>-Desktop-Duivencompetitie/memory
mkdir -p "$DEST"
cp claude-memory/*.md "$DEST"/
```

> Het mapnaam-deel `-Users-...-Desktop-Duivencompetitie` is het projectpad met
> slashes vervangen door streepjes. Zet je het project ergens anders neer, pas dan
> dat deel aan. Claude maakt dit pad normaal ook zelf aan zodra je in die map een
> sessie start; het kopiëren zorgt dat de eerdere kennis er meteen weer is.

## Belangrijkste afspraak (niet vergeten)

⛔ Blijf van de Google **Form**-bestanden af ("Tourpoule 2026 - Reacties"). Geen
Form-koppeling bouwen tenzij je er expliciet om vraagt.

📅 Voor seizoen **2026** vullen we samen de nieuwe database (deelnemers +
duivenkeuzes) via de Voorbereiden- en Keuzemoment-pagina's.
