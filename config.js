/*
 * config.js — koppeling met de Apps Script Web App.
 *
 * API_URL is de /exec-URL van de implementatie in project DASN. Die blijft gelijk
 * zolang je bij het uitrollen "Implementaties beheren → Nieuwe versie" kiest.
 */
window.DUIVEN_CONFIG = {
  // Bijvoorbeeld: "https://script.google.com/macros/s/AKfy...../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbyVlL3TGQX2IY3yBG4v5RD4w7bQmfqx3cazGVSm60Ei1yndms0WEvyIfm-fAnYP7Dliyw/exec",

  // Terugval-titel; het echte jaartal komt uit de Sheet (Instellingen › seizoen).
  SEIZOEN: "Duivencompetitie",

  // Aantal posities (aankomstplekken) dat je per vlucht invult.
  AANTAL_POSITIES: 25,

  // Terugval voor het maximum aantal duiven per team; het echte getal stel je in
  // op Voorbereiden (stap 5).
  DUIVEN_PER_TEAM: 8
};
