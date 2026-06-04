/*
 * Code.gs — Apps Script Web App voor de duivencompetitie.
 *
 * Rol: de Google Sheet is de database; dit script is de (gratis) API ertussen.
 *   - doGet()  -> geeft de ruwe tabellen als JSON terug (de site rekent zelf).
 *   - doPost() -> slaat een nieuwe vlucht-uitslag op in het tabblad "Resultaten".
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
  deelnemers: 'Deelnemers'
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

/** GET: geef alle ruwe data terug. */
function doGet(e) {
  try {
    return jsonOut({
      ok: true,
      duiven: readSheet(TAB.duiven),
      resultaten: readSheet(TAB.resultaten),
      punten: readSheet(TAB.punten),
      deelnemers: readSheet(TAB.deelnemers)
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  }
}

/** POST: sla een nieuwe vlucht-uitslag op.
 *  Body: { vlucht: <nummer>, finishers: [ {positie, ring_kort, naam_override} ], overwrite?: bool } */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // voorkom dat twee mensen tegelijk schrijven

    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
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
  } catch (err) {
    return jsonOut({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
