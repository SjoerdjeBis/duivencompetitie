/*
 * scoring.js — gedeelde data- en rekenlogica voor de duivencompetitie.
 *
 * Bewust framework-vrij en zonder build-stap, zodat het direct op GitHub Pages
 * draait én letterlijk dezelfde berekening gebruikt wordt voor de live-modus
 * (data uit de Apps Script API) en de demo-modus (gebundelde CSV's in /data).
 *
 * De Apps Script API levert alleen de RUWE tabellen (duiven, resultaten,
 * puntentabel, deelnemers); alle afgeleide standen worden hier berekend.
 */
(function (global) {
  'use strict';

  /** Parse CSV-tekst naar een array van objecten op basis van de headerrij. */
  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') cur += c;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(c => c.trim() !== ''))
      .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
  }

  /** Splits een teamveld ("A | B") naar een schone lijst deelnemers. */
  function splitTeams(s) {
    return (s || '').split('|').map(t => t.trim()).filter(Boolean);
  }

  /**
   * Bouwt een werkbaar model uit de ruwe rijen.
   * @param {{duiven:Array, resultaten:Array, punten:Array, deelnemers:Array}} raw
   */
  function buildModel(raw) {
    const duiven = (raw.duiven || []).map(d => ({
      naam: d.naam,
      ring_lang: d.ring_lang,
      ring_kort: d.ring_kort,
      teams: splitTeams(d.teams)
    }));

    const byKort = {};   // "765" -> [duif, ...]  (lijst i.v.m. mogelijke botsing)
    const byNaam = {};
    duiven.forEach(d => {
      if (d.ring_kort) (byKort[d.ring_kort] = byKort[d.ring_kort] || []).push(d);
      if (d.naam) byNaam[d.naam] = d;
    });

    const punten = {};
    (raw.punten || []).forEach(p => { punten[Number(p.positie)] = Number(p.punten); });

    // Expliciete deelnemerslijst (in invoervolgorde) — los van de duiven.
    const deelnemers = (raw.deelnemers || []).map(r => r.naam).filter(Boolean);

    // Roster van deelnemers: expliciete lijst + alles wat in teams voorkomt.
    const roster = new Set(deelnemers);
    duiven.forEach(d => d.teams.forEach(t => roster.add(t)));

    // Resultaten groeperen per vlucht.
    const vluchtenMap = {};
    (raw.resultaten || []).forEach(r => {
      const nr = Number(r.vlucht);
      if (!nr) return;
      (vluchtenMap[nr] = vluchtenMap[nr] || []).push({
        positie: Number(r.positie),
        ring_kort: r.ring_kort || '',
        naam_override: r.naam_override || ''
      });
    });
    const vluchten = Object.keys(vluchtenMap).map(Number).sort((a, b) => a - b)
      .map(nr => ({ nummer: nr, finishers: vluchtenMap[nr].sort((a, b) => a.positie - b.positie) }));

    return { duiven, byKort, byNaam, punten, roster, deelnemers, vluchten };
  }

  /** Zoekt de duif bij een finisher-regel.
   *  naam_override heeft voorrang: zo lost de invoer een botsing op twee duiven
   *  met hetzelfde korte ringnummer eenduidig op. Daarna pas op kort ringnummer. */
  function resolveDuif(model, finisher) {
    if (finisher.naam_override && model.byNaam[finisher.naam_override]) {
      return model.byNaam[finisher.naam_override];
    }
    if (finisher.ring_kort && model.byKort[finisher.ring_kort]) {
      return model.byKort[finisher.ring_kort][0];
    }
    // Onbekende finisher (bv. "Reserve Duif") — geen team, levert niemand punten op.
    return { naam: finisher.naam_override || ('?' + finisher.ring_kort), teams: [], onbekend: true };
  }

  /**
   * Berekent de volledige tussenstand uit het model.
   * @returns {{klassement, laatsteVlucht, besteDuiven, vluchten, aantalVluchten}}
   */
  function computeStandings(model) {
    const totaal = {};                 // deelnemer -> totaal punten
    const perVlucht = {};              // deelnemer -> {vluchtnr -> punten}
    const duifTotaal = {};             // duifnaam -> {naam, teams, totaal}
    model.roster.forEach(d => { totaal[d] = 0; perVlucht[d] = {}; });

    model.vluchten.forEach(v => {
      v.finishers.forEach(f => {
        const duif = resolveDuif(model, f);
        const pts = model.punten[f.positie] || 0;
        f._duif = duif; f._punten = pts; // verrijking voor weergave
        if (duif.naam) {
          const dt = duifTotaal[duif.naam] || (duifTotaal[duif.naam] = { naam: duif.naam, teams: duif.teams, totaal: 0 });
          dt.totaal += pts;
        }
        duif.teams.forEach(t => {
          if (!(t in totaal)) { totaal[t] = 0; perVlucht[t] = {}; }
          totaal[t] += pts;
          perVlucht[t][v.nummer] = (perVlucht[t][v.nummer] || 0) + pts;
        });
      });
    });

    const aantalVluchten = model.vluchten.length;
    const laatsteNr = aantalVluchten ? model.vluchten[aantalVluchten - 1].nummer : null;
    const vorigeNr = aantalVluchten > 1 ? model.vluchten[aantalVluchten - 2].nummer : null;

    // Rang vóór de laatste vlucht (voor stijgers/dalers).
    const rangVoor = rankOf(d => sumTot(perVlucht[d], laatsteNr) , model.roster);

    const klassement = [...model.roster].map(d => ({
      deelnemer: d,
      totaal: totaal[d] || 0,
      laatste: laatsteNr ? (perVlucht[d][laatsteNr] || 0) : 0
    })).sort((a, b) => b.totaal - a.totaal || a.deelnemer.localeCompare(b.deelnemer));

    klassement.forEach((row, i) => {
      row.rang = i + 1;
      const vroeger = rangVoor[row.deelnemer];
      row.rangVerschil = (vroeger == null) ? 0 : (vroeger - row.rang); // + = gestegen
    });

    const laatsteVlucht = laatsteNr ? {
      nummer: laatsteNr,
      scores: [...model.roster].map(d => ({ deelnemer: d, punten: perVlucht[d][laatsteNr] || 0 }))
        .filter(x => x.punten > 0)
        .sort((a, b) => b.punten - a.punten)
    } : null;

    const besteDuiven = Object.values(duifTotaal)
      .sort((a, b) => b.totaal - a.totaal || a.naam.localeCompare(b.naam));

    return { klassement, laatsteVlucht, besteDuiven, vluchten: model.vluchten, aantalVluchten };

    // -- helpers --
    function sumTot(perV, totMaxNr) {
      // som van punten t/m (maar niet inclusief) totMaxNr
      let s = 0;
      for (const nr in perV) if (Number(nr) < totMaxNr) s += perV[nr];
      return s;
    }
  }

  /** Geeft een map deelnemer->rang op basis van een scorefunctie (hoog = beter). */
  function rankOf(scoreFn, roster) {
    const arr = [...roster].map(d => ({ d, s: scoreFn(d) }))
      .sort((a, b) => b.s - a.s || a.d.localeCompare(b.d));
    const out = {};
    arr.forEach((x, i) => { out[x.d] = i + 1; });
    return out;
  }

  global.Scoring = { parseCSV, splitTeams, buildModel, computeStandings, resolveDuif };
})(typeof window !== 'undefined' ? window : globalThis);
