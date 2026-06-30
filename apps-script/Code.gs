/*
 * Code.gs — Apps Script Web App voor de duivencompetitie.
 *
 * Rol: de Google Sheet is de database; dit script is de (gratis) API ertussen.
 *   - doGet()  -> geeft de ruwe tabellen als JSON terug (de site rekent zelf).
 *   - doPost() -> router op payload.action:
 *        "uitslag" (standaard) : nieuwe vlucht-uitslag in tabblad "Resultaten".
 *        "setupSeizoen"        : vervangt deelnemers- en duivenlijst (seizoensstart).
 *
 * De Sheet heeft vier tabbladen met deze EXACTE kopregels (rij 1):
 *   Duivendatabase : naam | ring_lang | ring_kort | teams
 *   Resultaten     : vlucht | positie | ring_kort | naam_override
 *   Puntentabel    : positie | punten
 *   Deelnemers     : naam
 *
 * Deployen: Extensies → Apps Script → plak dit → Implementeren → Nieuwe implementatie
 *   → type "Web-app" → Uitvoeren als: ikzelf → Toegang: "Iedereen" → kopieer /exec-URL
 *   en zet die in config.js (API_URL).
 *
 * CORS-noot: de site doet GET (werkt direct) en POST met Content-Type text/plain
 * (vermijdt een preflight die Apps Script niet kan beantwoorden); de body is JSON-tekst.
 */

var TAB = {
  duiven: 'Duivendatabase',
  resultaten: 'Resultaten',
  punten: 'Puntentabel',
  deelnemers: 'Deelnemers',
  instellingen: 'Instellingen'
};

/** Leest een tabblad als array van objecten op basis van de kopregel. */
function readSheet(naam) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(naam);
  if (!sh) throw new Error('Tabblad "' + naam + '" niet gevonden.');
  var values = sh.getDataRange().getValues();
  if (values.length < 1) return [];
  var header = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      if (header[c]) obj[header[c]] = (row[c] === null) ? '' : String(row[c]).trim();
    }
    rows.push(obj);
  }
  return rows;
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Leest het tabblad "Instellingen" (kolommen: sleutel | waarde) als object.
 *  Ontbreekt het tabblad, dan geeft dit gewoon {} terug (geen fout). */
function readInstellingen() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.instellingen);
  if (!sh) return {};
  var values = sh.getDataRange().getValues();
  var out = {};
  for (var r = 1; r < values.length; r++) {
    var sleutel = String(values[r][0] || '').trim();
    if (!sleutel) continue;
    var waarde = values[r][1];
    out[sleutel] = (waarde === '' || waarde === null) ? '' : waarde;
  }
  return out;
}

/** GET: geef alle ruwe data terug. */
function doGet(e) {
  try {
    return jsonOut({
      ok: true,
      duiven: readSheet(TAB.duiven),
      resultaten: readSheet(TAB.resultaten),
      punten: readSheet(TAB.punten),
      deelnemers: readSheet(TAB.deelnemers),
      instellingen: readInstellingen()
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

/** POST-router. Kiest op basis van payload.action.
 *   - "uitslag" (standaard) -> slaat een vlucht-uitslag op.
 *   - "setupSeizoen"        -> vervangt de deelnemers- en duivenlijst (seizoensstart). */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // voorkom dat twee mensen tegelijk schrijven
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'setupSeizoen') return setupSeizoen(payload);
    if (payload.action === 'kiesDuif') return kiesDuif(payload);
    if (payload.action === 'hernoemDuif') return hernoemDuif(payload);
    if (payload.action === 'verwijderUitTeam') return verwijderUitTeam(payload);
    if (payload.action === 'resetDuiven') return resetDuiven(payload);
    if (payload.action === 'setInstellingen') return setInstellingen(payload);
    return saveUitslag(payload);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Sla een nieuwe vlucht-uitslag op.
 *  Body: { vlucht: <nummer>, finishers: [ {positie, ring_kort, naam_override} ], overwrite?: bool } */
function saveUitslag(payload) {
    var vlucht = Number(payload.vlucht);
    var finishers = payload.finishers || [];

    if (!vlucht) throw new Error('Geen geldig vluchtnummer.');
    if (!finishers.length) throw new Error('Geen finishers meegegeven.');

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.resultaten);
    if (!sh) throw new Error('Tabblad "' + TAB.resultaten + '" niet gevonden.');

    var header = sh.getDataRange().getValues()[0].map(function (h) { return String(h).trim(); });
    var idx = {
      vlucht: header.indexOf('vlucht'),
      positie: header.indexOf('positie'),
      ring_kort: header.indexOf('ring_kort'),
      naam_override: header.indexOf('naam_override')
    };
    if (idx.vlucht < 0 || idx.positie < 0 || idx.ring_kort < 0) {
      throw new Error('Kopregel van "Resultaten" mist een kolom (vlucht/positie/ring_kort).');
    }

    // Bestaat deze vlucht al?
    var bestaande = readSheet(TAB.resultaten).filter(function (r) { return Number(r.vlucht) === vlucht; });
    if (bestaande.length && !payload.overwrite) {
      throw new Error('Vlucht ' + vlucht + ' bestaat al (' + bestaande.length +
        ' regels). Stuur overwrite=true om te vervangen.');
    }
    if (bestaande.length && payload.overwrite) {
      // Verwijder bestaande regels van deze vlucht (van onder naar boven).
      var all = sh.getDataRange().getValues();
      for (var r = all.length - 1; r >= 1; r--) {
        if (Number(all[r][idx.vlucht]) === vlucht) sh.deleteRow(r + 1);
      }
    }

    // Voeg de nieuwe regels toe.
    var nieuwe = finishers.map(function (f) {
      var row = new Array(header.length).fill('');
      row[idx.vlucht] = vlucht;
      row[idx.positie] = Number(f.positie);
      row[idx.ring_kort] = String(f.ring_kort || '');
      if (idx.naam_override >= 0) row[idx.naam_override] = String(f.naam_override || '');
      return row;
    });
    sh.getRange(sh.getLastRow() + 1, 1, nieuwe.length, header.length).setValues(nieuwe);

    return jsonOut({ ok: true, vlucht: vlucht, aantal: nieuwe.length });
}

/** Vervangt de inhoud (onder de kopregel) van een tabblad door nieuwe rijen.
 *  rows2D = array van arrays, in dezelfde kolomvolgorde als de meegegeven header. */
function writeTab(naam, header, rows2D) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(naam);
  if (!sh) throw new Error('Tabblad "' + naam + '" niet gevonden.');
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  // Borg de kopregel.
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (rows2D.length) sh.getRange(2, 1, rows2D.length, header.length).setValues(rows2D);
}

/** Seizoensstart: vervang de deelnemers- en duivenlijst.
 *  Body: { deelnemers: [naam, ...],
 *          duiven: [ {ring_lang, ring_kort}, ... ],
 *          wisUitslagen?: bool }
 *  De duiven krijgen (nog) lege naam/teams — die volgen op het keuzemoment. */
function setupSeizoen(payload) {
    var deelnemers = (payload.deelnemers || [])
      .map(function (n) { return String(n || '').trim(); })
      .filter(Boolean);
    var duiven = (payload.duiven || []).filter(function (d) { return d && d.ring_lang; });

    if (!deelnemers.length) throw new Error('Geen deelnemers meegegeven.');
    if (!duiven.length) throw new Error('Geen duiven meegegeven.');

    // Deelnemers-tabblad: header [naam].
    writeTab(TAB.deelnemers, ['naam'], deelnemers.map(function (n) { return [n]; }));

    // Duivendatabase-tabblad: header [naam, ring_lang, ring_kort, teams]; naam/teams nog leeg.
    var duifRows = duiven.map(function (d) {
      return ['', String(d.ring_lang).trim(), String(d.ring_kort || '').trim(), ''];
    });
    writeTab(TAB.duiven, ['naam', 'ring_lang', 'ring_kort', 'teams'], duifRows);

    // Nieuw seizoen: optioneel de uitslagen van vorig jaar wissen.
    if (payload.wisUitslagen) {
      writeTab(TAB.resultaten, ['vlucht', 'positie', 'ring_kort', 'naam_override'], []);
    }

    return jsonOut({
      ok: true,
      deelnemers: deelnemers.length,
      duiven: duiven.length,
      uitslagenGewist: !!payload.wisUitslagen
    });
}

/** Keuzemoment: zet naam + team op één duif in de Duivendatabase.
 *  Body: { ring_kort?, ring_lang?, naam, team }
 *  Zoekt de rij op ring_lang (voorkeur) of ring_kort en vult naam + teams in.
 *  Een al ingevuld team wordt aangevuld (' | ') voor het geval van deelduiven.
 *  Met exclusief:true (decentraal keuzemoment) wordt een duif die al een team
 *  heeft geweigerd, zodat twee teams nooit dezelfde duif kunnen claimen. */
function kiesDuif(payload) {
    var team = String(payload.team || '').trim();
    var naam = String(payload.naam || '').trim();
    var lang = String(payload.ring_lang || '').trim();
    var kort = String(payload.ring_kort || '').trim();
    if (!team) throw new Error('Geen team meegegeven.');
    if (!lang && !kort) throw new Error('Geen ringnummer meegegeven.');

    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.duiven);
    if (!sh) throw new Error('Tabblad "' + TAB.duiven + '" niet gevonden.');
    var values = sh.getDataRange().getValues();
    var header = values[0].map(function (h) { return String(h).trim(); });
    var cNaam = header.indexOf('naam');
    var cLang = header.indexOf('ring_lang');
    var cKort = header.indexOf('ring_kort');
    var cTeams = header.indexOf('teams');
    if (cLang < 0 || cKort < 0 || cTeams < 0 || cNaam < 0) {
      throw new Error('Kopregel van "Duivendatabase" mist een kolom.');
    }

    for (var r = 1; r < values.length; r++) {
      var rowLang = String(values[r][cLang]).trim();
      var rowKort = String(values[r][cKort]).trim();
      var match = lang ? (rowLang === lang) : (rowKort === kort);
      if (!match) continue;

      var huidig = String(values[r][cTeams]).trim();
      var teams = huidig ? huidig.split('|').map(function (t) { return t.trim(); }).filter(Boolean) : [];
      // Claim-bescherming: duif al door een ander team gekozen -> weiger.
      if (payload.exclusief && teams.length && teams.indexOf(team) < 0) {
        throw new Error('Duif ' + (rowKort || rowLang) + ' is net door een ander team gekozen.');
      }

      if (naam) sh.getRange(r + 1, cNaam + 1).setValue(naam);
      if (teams.indexOf(team) < 0) teams.push(team);
      sh.getRange(r + 1, cTeams + 1).setValue(teams.join(' | '));

      return jsonOut({ ok: true, ring_lang: rowLang, ring_kort: rowKort, naam: naam, teams: teams.join(' | ') });
    }
    throw new Error('Duif met ringnummer ' + (lang || kort) + ' niet gevonden.');
}

/** Geeft het Duivendatabase-tabblad + kolomindexen terug (gedeeld door de wijzig-acties). */
function duivenSheetCtx() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.duiven);
  if (!sh) throw new Error('Tabblad "' + TAB.duiven + '" niet gevonden.');
  var values = sh.getDataRange().getValues();
  var header = values[0].map(function (h) { return String(h).trim(); });
  var idx = {
    naam: header.indexOf('naam'),
    lang: header.indexOf('ring_lang'),
    kort: header.indexOf('ring_kort'),
    teams: header.indexOf('teams')
  };
  if (idx.naam < 0 || idx.lang < 0 || idx.kort < 0 || idx.teams < 0) {
    throw new Error('Kopregel van "Duivendatabase" mist een kolom.');
  }
  return { sh: sh, values: values, idx: idx };
}

/** Hernoem één duif. Body: { ring_lang, naam }. Zoekt op ring_lang. */
function hernoemDuif(payload) {
    var lang = String(payload.ring_lang || '').trim();
    var naam = String(payload.naam || '').trim();
    if (!lang) throw new Error('Geen ringnummer (ring_lang) meegegeven.');
    if (!naam) throw new Error('Geen nieuwe naam meegegeven.');

    var ctx = duivenSheetCtx();
    for (var r = 1; r < ctx.values.length; r++) {
      if (String(ctx.values[r][ctx.idx.lang]).trim() !== lang) continue;
      ctx.sh.getRange(r + 1, ctx.idx.naam + 1).setValue(naam);
      return jsonOut({ ok: true, ring_lang: lang, naam: naam });
    }
    throw new Error('Duif met ringnummer ' + lang + ' niet gevonden.');
}

/** Haal één duif uit één team. Body: { ring_lang, team }.
 *  Verwijdert alleen dat team uit het teams-veld; de duif en zijn naam blijven bestaan. */
function verwijderUitTeam(payload) {
    var lang = String(payload.ring_lang || '').trim();
    var team = String(payload.team || '').trim();
    if (!lang) throw new Error('Geen ringnummer (ring_lang) meegegeven.');
    if (!team) throw new Error('Geen team meegegeven.');

    var ctx = duivenSheetCtx();
    for (var r = 1; r < ctx.values.length; r++) {
      if (String(ctx.values[r][ctx.idx.lang]).trim() !== lang) continue;
      var huidig = String(ctx.values[r][ctx.idx.teams]).trim();
      var teams = huidig ? huidig.split('|').map(function (t) { return t.trim(); }).filter(Boolean) : [];
      teams = teams.filter(function (t) { return t !== team; });
      ctx.sh.getRange(r + 1, ctx.idx.teams + 1).setValue(teams.join(' | '));
      return jsonOut({ ok: true, ring_lang: lang, teams: teams.join(' | ') });
    }
    throw new Error('Duif met ringnummer ' + lang + ' niet gevonden.');
}

/** Reset alle duiven: wist naam + teams van elke duif (de ringnummers blijven staan).
 *  Handig om vóór een nieuw keuzemoment met een schone lei te beginnen. */
function resetDuiven(payload) {
    var ctx = duivenSheetCtx();
    var n = ctx.values.length - 1;
    if (n > 0) {
      // Wis de hele naam- en teams-kolom onder de kopregel in één keer.
      ctx.sh.getRange(2, ctx.idx.naam + 1, n, 1).clearContent();
      ctx.sh.getRange(2, ctx.idx.teams + 1, n, 1).clearContent();
    }
    return jsonOut({ ok: true, duiven: Math.max(0, n) });
}

/** Slaat beheer-instellingen op in het tabblad "Instellingen" (sleutel | waarde).
 *  Body: { duivenPerTeam?: <getal>, ... }. Maakt het tabblad aan als het ontbreekt
 *  en werkt bestaande sleutels bij (upsert). De 'action'-sleutel wordt overgeslagen. */
function setInstellingen(payload) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TAB.instellingen);
    if (!sh) {
      sh = ss.insertSheet(TAB.instellingen);
      sh.getRange(1, 1, 1, 2).setValues([['sleutel', 'waarde']]);
    }
    // Bestaande sleutels -> rijnummer.
    var values = sh.getDataRange().getValues();
    var rijVan = {};
    for (var r = 1; r < values.length; r++) {
      var s = String(values[r][0] || '').trim();
      if (s) rijVan[s] = r + 1;
    }
    var gezet = {};
    Object.keys(payload).forEach(function (sleutel) {
      if (sleutel === 'action') return;
      var waarde = payload[sleutel];
      if (rijVan[sleutel]) {
        sh.getRange(rijVan[sleutel], 2).setValue(waarde);
      } else {
        sh.appendRow([sleutel, waarde]);
      }
      gezet[sleutel] = waarde;
    });
    return jsonOut({ ok: true, instellingen: gezet });
}