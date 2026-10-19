/*
 * Code.gs — Apps Script Web App voor de duivencompetitie.
 *
 * Rol: de Google Sheet is de database; dit script is de (gratis) API ertussen.
 *   - doGet()  -> geeft de ruwe tabellen als JSON terug (de site rekent zelf).
 *   - doPost() -> router op payload.action (zie doPost voor de volledige lijst).
 *
 * De Sheet heeft deze tabbladen met EXACTE kopregels (rij 1):
 *   Duivendatabase : naam | ring_lang | ring_kort | teams
 *   Resultaten     : vlucht | positie | ring_kort | naam_override
 *   Puntentabel    : positie | punten
 *   Deelnemers     : naam
 *   Instellingen   : sleutel | waarde   (o.a. seizoen, duivenPerTeam, archief_<jaar>)
 *
 * Deployen (project "DASN", gekoppeld aan de Sheet): plak dit in Code.gs → opslaan →
 *   Implementeren → Implementaties beheren → potlood → Versie: "Nieuwe versie" →
 *   Implementeren. NIET "Nieuwe implementatie", want dan verandert de /exec-URL.
 *
 * CORS-noot: de site doet GET (werkt direct) en POST met Content-Type text/plain
 * (vermijdt een preflight die Apps Script niet kan beantwoorden); de body is JSON-tekst.
 *
 * Beveiliging: elke POST moet de beheercode meesturen (payload.code). Stel die in via
 * Projectinstellingen (tandwiel) → Scripteigenschappen → eigenschap BEHEER_CODE.
 * Zonder ingestelde BEHEER_CODE weigert het script alle schrijfacties. Lezen (GET)
 * blijft open, want de site toont die data toch al.
 * Uitzondering: kiesDuif met exclusief:true (een team kiest op het keuzemoment een
 * VRIJE duif via zijn eigen teamlink) mag zonder code — die kan niets overschrijven.
 *
 * LET OP: dit is het ENIGE API-bestand in het Apps Script-project. Maak nooit een
 * tweede .gs met een eigen doPost — Apps Script laadt alle bestanden in één scope.
 */

var TAB = {
  duiven: 'Duivendatabase',
  resultaten: 'Resultaten',
  punten: 'Puntentabel',
  deelnemers: 'Deelnemers',
  instellingen: 'Instellingen'
};

var MAX_NAAM = 40; // maximale lengte van een duivennaam

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

/** POST-router. Kiest op basis van payload.action:
 *   uitslag (standaard) · checkCode · kiesDuif · hernoemDuif · verwijderUitTeam ·
 *   resetDuiven · setInstellingen · archiveerSeizoen · nieuwSeizoen · setDuiven ·
 *   setDeelnemers · verwijderVlucht. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // voorkom dat twee mensen tegelijk schrijven
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var openbaar = payload.action === 'kiesDuif' && payload.exclusief === true;
    if (!openbaar) {
      var verwacht = PropertiesService.getScriptProperties().getProperty('BEHEER_CODE');
      if (!verwacht) {
        return jsonOut({ ok: false, auth: true, nietIngesteld: true,
          error: 'Opslaan staat uit: stel eerst BEHEER_CODE in bij de Scripteigenschappen.' });
      }
      if (String(payload.code || '') !== verwacht) {
        return jsonOut({ ok: false, auth: true, error: 'Beheercode onjuist.' });
      }
    }
    delete payload.code;
    switch (payload.action) {
      case 'checkCode': return jsonOut({ ok: true });
      case 'kiesDuif': return kiesDuif(payload);
      case 'hernoemDuif': return hernoemDuif(payload);
      case 'verwijderUitTeam': return verwijderUitTeam(payload);
      case 'resetDuiven': return resetDuiven(payload);
      case 'setInstellingen': return setInstellingen(payload);
      case 'archiveerSeizoen': return archiveerSeizoen(payload);
      case 'nieuwSeizoen': return nieuwSeizoen(payload);
      case 'setDuiven': return setDuiven(payload);
      case 'setDeelnemers': return setDeelnemers(payload);
      case 'verwijderVlucht': return verwijderVlucht(payload);
      default: return saveUitslag(payload);
    }
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

    // Bestaande regels van deze vlucht (voor overschrijven en/of overlap-controle).
    var bestaande = readSheet(TAB.resultaten).filter(function (r) { return Number(r.vlucht) === vlucht; });

    if (bestaande.length && payload.overwrite) {
      // Hele vlucht vervangen: verwijder bestaande regels (van onder naar boven).
      var all = sh.getDataRange().getValues();
      for (var r = all.length - 1; r >= 1; r--) {
        if (Number(all[r][idx.vlucht]) === vlucht) sh.deleteRow(r + 1);
      }
      bestaande = [];
    }

    // Overlap-controle i.p.v. blokkeren op vluchtnummer: een uitslag mag in
    // meerdere delen worden ingestuurd (bv. eerst plek 1-9, daarna de rest),
    // zolang dezelfde duif of dezelfde plaats niet twee keer voorkomt.
    if (bestaande.length) {
      // Sleutel per duif: bij een botsing staat het lange ringnummer in naam_override,
      // zodat twee duiven met dezelfde laatste 3 cijfers elkaar niet blokkeren.
      var duifKey = function (r) {
        var ov = String(r.naam_override || '').trim();
        return /\d/.test(ov) ? ov : String(r.ring_kort || '').trim();
      };
      var ringGezet = {}, posGezet = {};
      bestaande.forEach(function (r) {
        var rk = duifKey(r);
        if (rk) ringGezet[rk] = true;
        posGezet[Number(r.positie)] = true;
      });
      var dubbeleDuiven = [], dubbelePlaatsen = [];
      finishers.forEach(function (f) {
        var rk = duifKey(f);
        if (rk && ringGezet[rk] && dubbeleDuiven.indexOf(rk) < 0) dubbeleDuiven.push(rk);
        var p = Number(f.positie);
        if (posGezet[p] && dubbelePlaatsen.indexOf(p) < 0) dubbelePlaatsen.push(p);
      });
      if (dubbeleDuiven.length || dubbelePlaatsen.length) {
        var msg = 'Deze invoer overlapt met wat al in vlucht ' + vlucht + ' staat.';
        if (dubbeleDuiven.length) msg += ' Al ingevoerde duif/duiven: ' + dubbeleDuiven.join(', ') + '.';
        if (dubbelePlaatsen.length) msg += ' Al ingevulde plaats(en): ' + dubbelePlaatsen.join(', ') + '.';
        msg += ' Haal die uit je invoer, of vink "Bestaande vlucht vervangen" aan om de hele vlucht opnieuw te doen.';
        throw new Error(msg);
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

    return jsonOut({ ok: true, vlucht: vlucht, aantal: nieuwe.length,
      totaal: bestaande.length + nieuwe.length });
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
    if (naam.length > MAX_NAAM) throw new Error('Die naam is te lang (max ' + MAX_NAAM + ' tekens).');
    // Via een teamlink (zonder beheercode) mag alleen een bestaand team kiezen.
    if (payload.exclusief) {
      var bekend = readSheet(TAB.deelnemers).some(function (d) { return d.naam === team; });
      if (!bekend) throw new Error('Onbekend team: ' + team + '.');
    }

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
    if (naam.length > MAX_NAAM) throw new Error('Die naam is te lang (max ' + MAX_NAAM + ' tekens).');

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
 *  Body: { duivenPerTeam?: <getal>, ... }. De 'action'-sleutel wordt overgeslagen. */
function setInstellingen(payload) {
    var waarden = {};
    Object.keys(payload).forEach(function (k) { if (k !== 'action') waarden[k] = payload[k]; });
    return jsonOut({ ok: true, instellingen: upsertInstellingen(waarden) });
}

/** Schrijft sleutels naar "Instellingen" (maakt het tabblad aan als het ontbreekt;
 *  bestaande sleutels worden bijgewerkt). */
function upsertInstellingen(waarden) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TAB.instellingen);
    if (!sh) {
      sh = ss.insertSheet(TAB.instellingen);
      sh.getRange(1, 1, 1, 2).setValues([['sleutel', 'waarde']]);
    }
    var values = sh.getDataRange().getValues();
    var rijVan = {};
    for (var r = 1; r < values.length; r++) {
      var s = String(values[r][0] || '').trim();
      if (s) rijVan[s] = r + 1;
    }
    Object.keys(waarden).forEach(function (sleutel) {
      if (rijVan[sleutel]) sh.getRange(rijVan[sleutel], 2).setValue(waarden[sleutel]);
      else sh.appendRow([sleutel, waarden[sleutel]]);
    });
    return waarden;
}

/** Huidig seizoen (jaartal) uit Instellingen, of payload.seizoen als die is meegegeven. */
function huidigSeizoen(payload) {
    var s = String((payload && payload.seizoen) || readInstellingen().seizoen || '').trim();
    if (!/^\d{4}$/.test(s)) throw new Error('Onbekend seizoen (verwacht een jaartal, bv. 2026).');
    return s;
}

/** Stap 1 — Archiveer dit seizoen: maakt een volledige kopie van deze Google Sheet
 *  ("Duivencompetitie <jaar> - ARCHIEF (<datum>)") en onthoudt de link als
 *  Instellingen › archief_<jaar>.
 *  Body: { seizoen?: '2026' }  — of, met { url }, alleen de link van een zelf
 *  gemaakte kopie vastleggen. */
function archiveerSeizoen(payload) {
    var seizoen = huidigSeizoen(payload);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var url = String(payload.url || '').trim(), naam = '';
    if (url) {
      if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) {
        throw new Error('Dat lijkt geen link naar een Google Sheet.');
      }
    } else {
      var datum = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'd-M-yyyy');
      naam = 'Duivencompetitie ' + seizoen + ' - ARCHIEF (' + datum + ')';
      var kopie = ss.copy(naam);
      url = kopie.getUrl();
    }
    var w = { seizoen: seizoen };
    w['archief_' + seizoen] = url;
    upsertInstellingen(w);
    return jsonOut({ ok: true, seizoen: seizoen, naam: naam, url: url });
}

/** Stap 2 — Leeg de database maar bewaar de teamnamen.
 *  Wist alle uitslagen én alle duiven (nieuw jaar = nieuwe ringnummers), laat de
 *  Deelnemers en de Puntentabel staan, en zet het seizoen op het nieuwe jaartal.
 *  Weigert zolang er geen archief van het huidige seizoen is vastgelegd.
 *  Body: { nieuwSeizoen: '2027' } */
function nieuwSeizoen(payload) {
    var inst = readInstellingen();
    var huidig = huidigSeizoen({ seizoen: inst.seizoen || payload.huidigSeizoen });
    var nieuw = String(payload.nieuwSeizoen || '').trim();
    if (!/^\d{4}$/.test(nieuw)) throw new Error('Geef het nieuwe seizoen als jaartal (bv. 2027).');
    if (!inst['archief_' + huidig]) {
      throw new Error('Er is nog geen archief van seizoen ' + huidig + '. Doe eerst stap 1.');
    }
    var uitslagen = readSheet(TAB.resultaten).length;
    var duiven = readSheet(TAB.duiven).length;
    var deelnemers = readSheet(TAB.deelnemers).length;
    writeTab(TAB.resultaten, ['vlucht', 'positie', 'ring_kort', 'naam_override'], []);
    writeTab(TAB.duiven, ['naam', 'ring_lang', 'ring_kort', 'teams'], []);
    upsertInstellingen({ seizoen: nieuw });
    return jsonOut({ ok: true, seizoen: nieuw, uitslagenGewist: uitslagen,
      duivenGewist: duiven, deelnemersBewaard: deelnemers });
}

/** Stap 3 — Duifnummers vastleggen. Veilig samenvoegen: duiven die al bestaan
 *  (zelfde ring_lang) houden hun naam en team; nieuwe komen er teamloos bij;
 *  duiven die niet meer in de lijst staan verdwijnen. Een duif MET team wordt
 *  alleen verwijderd als forceer:true is meegegeven.
 *  Body: { duiven: [ {ring_lang, ring_kort} ], forceer?: bool } */
function setDuiven(payload) {
    var lijst = (payload.duiven || []).filter(function (d) { return d && String(d.ring_lang || '').trim(); });
    var sleutel = function (lang) { return String(lang).replace(/\D/g, ''); };
    var oud = {};
    readSheet(TAB.duiven).forEach(function (d) { oud[sleutel(d.ring_lang)] = d; });

    var blijft = {};
    var rows = lijst.map(function (d) {
      var k = sleutel(d.ring_lang);
      blijft[k] = true;
      var o = oud[k] || {};
      return [o.naam || '', String(d.ring_lang).trim(), String(d.ring_kort || '').trim(), o.teams || ''];
    });
    var weg = Object.keys(oud).filter(function (k) { return !blijft[k]; });
    var wegMetTeam = weg.filter(function (k) { return oud[k].teams; })
      .map(function (k) { return oud[k].ring_lang + (oud[k].naam ? ' (' + oud[k].naam + ')' : ''); });
    if (wegMetTeam.length && !payload.forceer) {
      return jsonOut({ ok: false, wegMetTeam: wegMetTeam,
        error: 'Deze duiven hebben al een team en zouden verdwijnen: ' + wegMetTeam.join(', ') + '.' });
    }
    writeTab(TAB.duiven, ['naam', 'ring_lang', 'ring_kort', 'teams'], rows);
    return jsonOut({ ok: true, duiven: rows.length, verwijderd: weg.length,
      nieuw: rows.length - (Object.keys(oud).length - weg.length) });
}

/** Stap 4 — Teamnamen actualiseren. Vervangt de deelnemerslijst; bij een
 *  naamswijziging wordt de nieuwe naam ook in het teams-veld van de duiven gezet.
 *  Body: { deelnemers: [naam, ...], hernoemd?: [ {oud, nieuw} ] } */
function setDeelnemers(payload) {
    var namen = (payload.deelnemers || [])
      .map(function (n) { return String(n || '').trim(); }).filter(Boolean);
    if (!namen.length) throw new Error('Geen deelnemers meegegeven.');
    writeTab(TAB.deelnemers, ['naam'], namen.map(function (n) { return [n]; }));

    var map = {};
    (payload.hernoemd || []).forEach(function (h) {
      var o = String(h.oud || '').trim(), n = String(h.nieuw || '').trim();
      if (o && n && o !== n) map[o] = n;
    });
    var aangepast = 0;
    if (Object.keys(map).length) {
      var ctx = duivenSheetCtx();
      for (var r = 1; r < ctx.values.length; r++) {
        var huidig = String(ctx.values[r][ctx.idx.teams]).trim();
        if (!huidig) continue;
        var teams = huidig.split('|').map(function (t) { t = t.trim(); return map[t] || t; });
        var nieuw = teams.join(' | ');
        if (nieuw !== huidig) { ctx.sh.getRange(r + 1, ctx.idx.teams + 1).setValue(nieuw); aangepast++; }
      }
    }
    return jsonOut({ ok: true, deelnemers: namen.length, duivenAangepast: aangepast });
}

/** Verwijdert alle regels van één vlucht (etappe) uit "Resultaten".
 *  Body: { vlucht: <nummer> } */
function verwijderVlucht(payload) {
    var vlucht = Number(payload.vlucht);
    if (!vlucht) throw new Error('Geen geldig vluchtnummer.');
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.resultaten);
    if (!sh) throw new Error('Tabblad "' + TAB.resultaten + '" niet gevonden.');
    var all = sh.getDataRange().getValues();
    var c = all[0].map(function (h) { return String(h).trim(); }).indexOf('vlucht');
    var weg = 0;
    for (var r = all.length - 1; r >= 1; r--) {
      if (Number(all[r][c]) === vlucht) { sh.deleteRow(r + 1); weg++; }
    }
    if (!weg) throw new Error('Vlucht ' + vlucht + ' staat niet in de uitslagen.');
    return jsonOut({ ok: true, vlucht: vlucht, verwijderd: weg });
}
