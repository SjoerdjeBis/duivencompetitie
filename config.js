/*
 * config.js — pas dit één bestand aan na het deployen van de Apps Script Web App.
 *
 * Plak hieronder de Web App-URL (eindigt op /exec). Zolang deze leeg is, draait
 * de site in DEMO-modus op de gebundelde data in /data (handig om eerst te kijken).
 */
window.DUIVEN_CONFIG = {
  // Bijvoorbeeld: "https://script.google.com/macros/s/AKfy...../exec"
  API_URL: "",

  // Titel bovenaan de pagina's.
  SEIZOEN: "Duivencompetitie 2025",

  // Aantal posities (aankomstplekken) dat je per vlucht invult.
  AANTAL_POSITIES: 25,

  // Keuzemoment: richtgetal voor hoeveel duiven elk team kiest (je kunt tijdens
  // de draft per team eerder stoppen of een extra duif toevoegen).
  DUIVEN_PER_TEAM: 8
};
