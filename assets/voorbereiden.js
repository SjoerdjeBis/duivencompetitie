/* voorbereiden.js — seizoenswissel als stappenplan.
 *
 *  A · Seizoen afsluiten       1 Archiveer dit seizoen   2 Leeg de database (teams blijven)
 *  B · Nieuw seizoen klaarzetten 3 Duifnummers  4 Teamnamen  5 Aantal per team  6 Keuzemoment
 *
 * Het seizoen (jaartal) staat in de Sheet: Instellingen › seizoen. Zolang er
 * uitslagen zijn, is het seizoen "bezig" en staan stap 3-6 op slot.
 */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';

  const $ = id => document.getElementById(id);
  let M = null;          // het Scoring-model zoals laatst geladen
  let SEIZOEN = '';      // huidig seizoen (jaartal als tekst)

  function melding(id, soort, html) {
    const m = $(id);
    m.className = soort ? 'melding ' + soort : '';
    m.innerHTML = html || '';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /** Voert een knop-actie uit met "bezig…"-tekst en foutafhandeling. */
  async function metKnop(knop, bezigTekst, meldId, fn) {
    const oud = knop.textContent;
    knop.disabled = true; knop.textContent = bezigTekst;
    melding(meldId, '', '');
    try {
      await fn();
    } catch (err) {
      melding(meldId, 'fout', esc(err.message));
    } finally {
      knop.disabled = false; knop.textContent = oud;
      tekenStatus();
    }
  }

  function zetStap(id, status, pill) {
    const el = $(id);
    el.dataset.status = status;               // klaar | actief | wacht
    const p = el.querySelector('.stap-status');
    if (p) p.textContent = pill || '';
    el.querySelectorAll('.stap-body button, .stap-body input, .stap-body textarea')
      .forEach(x => { x.disabled = status === 'wacht'; });
  }

  /* ================= Status van alle stappen ================= */

  function tekenStatus() {
    const inst = M.instellingen || {};
    const vluchten = M.vluchten.length;
    const uitslagen = M.vluchten.reduce((n, v) => n + v.finishers.length, 0);
    const duiven = M.duiven.length;
    const gekozen = M.duiven.filter(d => d.teams.length).length;
    const teams = M.deelnemers.length;
    const bezig = vluchten > 0;                       // er zijn uitslagen → seizoen loopt nog
    const archief = inst['archief_' + SEIZOEN];
    const vorig = String(Number(SEIZOEN) - 1);
    const perTeam = Number(inst.duivenPerTeam) || 0;

    $('stand').innerHTML =
      '<span><strong>Seizoen ' + esc(SEIZOEN) + '</strong></span>' +
      '<span>' + vluchten + (vluchten === 1 ? ' etappe' : ' etappes') + '</span>' +
      '<span>' + duiven + (duiven === 1 ? ' duif' : ' duiven') + '</span>' +
      '<span>' + teams + ' teams</span>';

    /* ---- A · afsluiten ---- */
    $('fase-a-titel').textContent = 'A · Seizoen ' + (bezig ? SEIZOEN : vorig) + ' afsluiten';
    $('fase-b-titel').textContent = 'B · Seizoen ' + (bezig ? String(Number(SEIZOEN) + 1) : SEIZOEN) + ' klaarzetten';

    $('afgesloten').classList.toggle('verborgen', bezig);
    $('stap1').classList.toggle('verborgen', !bezig);
    $('stap2').classList.toggle('verborgen', !bezig);
    if (!bezig) {
      const link = inst['archief_' + vorig];
      $('afgesloten-titel').textContent = 'Seizoen ' + vorig + ' is afgesloten';
      $('afgesloten-tekst').innerHTML = 'De database is leeg gemaakt; de teamnamen zijn bewaard.' +
        (link ? ' Archief: <a href="' + esc(link) + '" target="_blank" rel="noopener">open de archiefkopie &#8599;</a>' : '');
    }

    $('archief-naam').textContent = 'Duivencompetitie ' + SEIZOEN + ' - ARCHIEF (datum)';
    if (archief) {
      zetStap('stap1', 'klaar', '✓ gearchiveerd');
      $('archief-link').innerHTML = '<div class="melding ok">✓ Archief van ' + esc(SEIZOEN) +
        ': <a href="' + esc(archief) + '" target="_blank" rel="noopener">open de kopie &#8599;</a></div>';
      $('archiveer').textContent = 'Nog een kopie maken';
      $('archiveer').className = 'ghost';
    } else {
      zetStap('stap1', 'actief', 'nu doen');
      $('archief-link').innerHTML = '';
    }

    zetStap('stap2', archief ? 'actief' : 'wacht', archief ? 'nu doen' : '');
    $('leeg-effect').innerHTML =
      '<li class="weg">Alle uitslagen worden gewist (' + vluchten + ' etappes, ' + uitslagen + ' regels) &rarr; stand op 0</li>' +
      '<li class="weg">Alle ' + duiven + ' duiven worden gewist (volgend jaar nieuwe ringnummers)</li>' +
      '<li class="blijft">De ' + teams + ' teamnamen blijven staan</li>' +
      '<li class="blijft">De puntentabel en het aantal duiven per team blijven staan</li>';
    if (!$('nieuw-seizoen').value) $('nieuw-seizoen').value = Number(SEIZOEN) + 1;

    /* ---- B · klaarzetten ---- */
    const slot = bezig ? 'wacht' : null;
    zetStap('stap3', slot || (duiven ? 'klaar' : 'actief'),
      slot ? '' : (duiven ? '✓ ' + duiven + ' duiven' : 'nu doen'));
    zetStap('stap4', slot || (teams ? 'klaar' : 'actief'),
      slot ? '' : (teams ? '✓ ' + teams + ' teams' : 'nu doen'));
    zetStap('stap5', slot || (perTeam ? 'klaar' : 'actief'),
      slot ? '' : (perTeam ? '✓ max ' + perTeam + ' per team' : 'nu doen'));

    const kanKiezen = !bezig && duiven && teams;
    $('stap6').dataset.status = !kanKiezen ? 'wacht' : (gekozen ? 'klaar' : 'actief');
    $('stap6').querySelector('.stap-status').textContent =
      !kanKiezen ? '' : (gekozen ? gekozen + ' van ' + duiven + ' duiven gekozen' : 'klaar om te starten');
    $('naar-keuzemoment').classList.toggle('uit', !kanKiezen);

    // Rekensommetje: genoeg duiven voor alle teams?
    const n = Number($('duiven-per-team').value) || perTeam;
    if (!bezig && teams && n) {
      const nodig = teams * n;
      const genoeg = duiven >= nodig;
      $('rekensom').innerHTML = '<p class="sub rekensom' + (genoeg ? '' : ' tekort') + '">' +
        teams + ' teams &times; ' + n + ' = <strong>' + nodig + ' duiven</strong> nodig als iedereen het maximum kiest; ' +
        'er staan er ' + duiven + ' klaar.' + (genoeg ? '' : ' Dat is te weinig voor het maximum.') + '</p>';
    } else {
      $('rekensom').innerHTML = '';
    }
  }

  /* ================= Stap 1 · Archiveren ================= */

  async function archiveer() {
    await metKnop($('archiveer'), 'Kopie maken… (even geduld)', 'melding1', async () => {
      const res = await API.archiveerSeizoen({ seizoen: SEIZOEN });
      M.instellingen['archief_' + SEIZOEN] = res.url;
      M.instellingen.seizoen = SEIZOEN;
      melding('melding1', 'ok', '✓ Gearchiveerd als <strong>' + esc(res.naam) + '</strong> in je Google Drive.');
    });
  }

  async function archiefUrlOpslaan() {
    const url = $('archief-url').value.trim();
    if (!url) return melding('melding1', 'fout', 'Plak eerst de link van je kopie.');
    await metKnop($('archief-url-opslaan'), 'Vastleggen…', 'melding1', async () => {
      const res = await API.archiveerSeizoen({ seizoen: SEIZOEN, url: url });
      M.instellingen['archief_' + SEIZOEN] = res.url;
      M.instellingen.seizoen = SEIZOEN;
      $('archief-url').value = '';
      melding('melding1', 'ok', '✓ Link vastgelegd als archief van ' + esc(SEIZOEN) + '.');
    });
  }

  /* ================= Stap 2 · Leegmaken ================= */

  async function leeg() {
    const nieuw = String($('nieuw-seizoen').value || '').trim();
    if (!/^\d{4}$/.test(nieuw)) return melding('melding2', 'fout', 'Vul het nieuwe seizoen in als jaartal.');
    const antwoord = window.prompt(
      'Hiermee worden ALLE uitslagen en ALLE duiven van ' + SEIZOEN + ' gewist.\n' +
      'De teamnamen blijven staan. Het archief blijft bewaard.\n\n' +
      'Typ ' + nieuw + ' om seizoen ' + nieuw + ' te starten:');
    if (antwoord === null) return;
    if (antwoord.trim() !== nieuw) return melding('melding2', 'fout', 'Niet gewist: het getypte jaartal klopte niet.');
    await metKnop($('leeg'), 'Leegmaken…', 'melding2', async () => {
      await API.nieuwSeizoen({ nieuwSeizoen: nieuw, huidigSeizoen: SEIZOEN });
      location.reload();
    });
  }

  /* ================= Stap 3 · Duiven ================= */

  /** Laatste 3 cijfers als 3-cijferige code ("1587085" -> "085"). */
  function kortVan(lang) {
    const d = String(lang || '').replace(/\D/g, '').slice(-3);
    return d ? d.padStart(3, '0') : '';
  }

  /** Leest het tekstvak uit naar een ontdubbelde lijst {ring_lang, ring_kort}. */
  function leesDuiven() {
    const tokens = ($('ringnummers').value || '')
      .split(/[\s,;]+/).map(t => t.trim()).filter(t => /\d/.test(t));
    const out = [];
    const seen = new Set();
    tokens.forEach(lang => {
      const key = lang.replace(/\D/g, '');
      if (!key || seen.has(key)) return;   // ontdubbel op cijfers
      seen.add(key);
      out.push({ ring_lang: lang, ring_kort: kortVan(lang) });
    });
    return out;
  }

  function tekenDuiven() {
    const duiven = leesDuiven();
    const preview = $('duiven-preview');
    preview.innerHTML = '';

    const perKort = {};
    duiven.forEach(d => (perKort[d.ring_kort] = perKort[d.ring_kort] || []).push(d));
    const botsKorts = new Set(Object.keys(perKort).filter(k => perKort[k].length > 1));

    duiven.forEach(d => {
      const chip = document.createElement('span');
      chip.className = 'ring-chip' + (botsKorts.has(d.ring_kort) ? ' bots' : '');
      chip.innerHTML = '<span class="lang">' + esc(d.ring_lang) + '</span>' +
        '<span class="kort">' + esc(d.ring_kort) + '</span>';
      preview.append(chip);
    });

    $('duiven-telling').textContent = duiven.length
      ? duiven.length + (duiven.length === 1 ? ' duif in de lijst' : ' duiven in de lijst') : '';

    const w = $('duiven-waarschuwing');
    if (botsKorts.size) {
      w.className = 'melding fout';
      w.innerHTML = '⚠ Let op: meerdere duiven eindigen op dezelfde 3 cijfers (' +
        [...botsKorts].join(', ') + '). Bij het invoeren van uitslagen moet er dan ' +
        'elke keer gekozen worden welke duif bedoeld is. Dat mag, maar check of het klopt.';
    } else {
      w.className = ''; w.innerHTML = '';
    }
  }

  async function duivenOpslaan() {
    const duiven = leesDuiven();
    if (!duiven.length && !window.confirm('De lijst is leeg. Alle duiven verwijderen?')) return;
    await metKnop($('duiven-opslaan'), 'Opslaan…', 'melding3', async () => {
      let res;
      try {
        res = await API.setDuiven({ duiven });
      } catch (err) {
        const weg = err.data && err.data.wegMetTeam;
        if (!weg) throw err;
        if (!window.confirm('Deze duiven hebben al een team, maar staan niet meer in je lijst:\n\n' +
            weg.join('\n') + '\n\nToch verwijderen?')) {
          return melding('melding3', 'fout', 'Niet opgeslagen. Er is niets veranderd.');
        }
        res = await API.setDuiven({ duiven, forceer: true });
      }
      await herlaad();
      melding('melding3', 'ok', '✓ ' + res.duiven + ' duiven opgeslagen' +
        (res.nieuw ? ' (' + res.nieuw + ' nieuw)' : '') +
        (res.verwijderd ? ', ' + res.verwijderd + ' verwijderd' : '') + '.');
    });
  }

  /* ================= Stap 4 · Teams ================= */

  function maakDeelnemerRij(naam, meedoet) {
    const rij = document.createElement('div');
    rij.className = 'deelnemer-rij';
    rij.dataset.oud = naam || '';

    const vink = document.createElement('input');
    vink.type = 'checkbox';
    vink.checked = meedoet !== false;
    vink.title = 'Doet mee';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'naam-input';
    inp.value = naam || '';
    inp.placeholder = 'Teamnaam, bv. Jan & Monique';
    inp.autocomplete = 'off';

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'verwijder';
    weg.title = 'Verwijderen';
    weg.textContent = '×';

    function sync() { rij.classList.toggle('uit', !vink.checked); telDeelnemers(); }
    vink.addEventListener('change', sync);
    inp.addEventListener('input', () => {
      rij.classList.toggle('hernoemd', !!rij.dataset.oud && inp.value.trim() !== rij.dataset.oud);
      telDeelnemers();
    });
    weg.addEventListener('click', () => { rij.remove(); telDeelnemers(); });

    rij.append(vink, inp, weg);
    rij.classList.toggle('uit', !vink.checked);
    return rij;
  }

  function leesDeelnemers() {
    const namen = [], hernoemd = [];
    const seen = new Set();
    document.querySelectorAll('.deelnemer-rij').forEach(rij => {
      const vink = rij.querySelector('input[type=checkbox]');
      const naam = rij.querySelector('.naam-input').value.trim();
      if (!vink.checked || !naam) return;
      const key = naam.toLowerCase();
      if (seen.has(key)) return;     // dubbele namen ontdubbelen
      seen.add(key);
      namen.push(naam);
      if (rij.dataset.oud && rij.dataset.oud !== naam) hernoemd.push({ oud: rij.dataset.oud, nieuw: naam });
    });
    return { namen, hernoemd };
  }

  function telDeelnemers() {
    const n = leesDeelnemers().namen.length;
    $('deelnemers-telling').textContent = n + (n === 1 ? ' team doet mee' : ' teams doen mee');
  }

  function vulDeelnemers() {
    const namen = M.deelnemers.slice().sort((a, b) => a.localeCompare(b, 'nl'));
    const lijst = $('deelnemers-lijst');
    lijst.innerHTML = '';
    namen.forEach(n => lijst.append(maakDeelnemerRij(n, true)));
    if (!namen.length) lijst.append(maakDeelnemerRij('', true));
    telDeelnemers();
  }

  async function deelnemersOpslaan() {
    const { namen, hernoemd } = leesDeelnemers();
    if (!namen.length) return melding('melding4', 'fout', 'Er doet nog geen enkel team mee.');
    const weg = M.deelnemers.filter(n => !namen.includes(n) && !hernoemd.some(h => h.oud === n));
    if (weg.length && !window.confirm('Deze teams doen niet meer mee:\n\n' + weg.join('\n') + '\n\nOpslaan?')) return;
    await metKnop($('deelnemers-opslaan'), 'Opslaan…', 'melding4', async () => {
      const res = await API.setDeelnemers({ deelnemers: namen, hernoemd });
      await herlaad();
      vulDeelnemers();
      melding('melding4', 'ok', '✓ ' + res.deelnemers + ' teams opgeslagen' +
        (res.duivenAangepast ? '; ' + res.duivenAangepast +
          (res.duivenAangepast === 1 ? ' duif kreeg' : ' duiven kregen') + ' de nieuwe teamnaam' : '') + '.');
    });
  }

  /* ================= Stap 5 · Aantal per team ================= */

  async function instellingOpslaan() {
    const n = Math.round(Number($('duiven-per-team').value) || 0);
    if (n < 1) return melding('melding5', 'fout', 'Vul een geldig aantal in.');
    await metKnop($('instelling-opslaan'), 'Opslaan…', 'melding5', async () => {
      await API.setInstellingen({ duivenPerTeam: n });
      M.instellingen.duivenPerTeam = n;
      melding('melding5', 'ok', '✓ Opgeslagen: maximaal ' + n + ' duiven per team.');
    });
  }

  /* ================= Noodknop ================= */

  async function resetDuiven() {
    if (!window.confirm('Alle duiven teamloos maken?\n\n' +
        'Dit wist bij élke duif de naam én het team. ' +
        'De ringnummers, teams en uitslagen blijven staan.\n\nDoorgaan?')) return;
    await metKnop($('reset-duiven'), 'Resetten…', 'melding-nood', async () => {
      const res = await API.resetDuiven();
      await herlaad();
      melding('melding-nood', 'ok', '✓ ' + res.duiven + ' duiven zijn teamloos gemaakt.');
    });
  }

  /* ================= Laden ================= */

  /** Laadt de data opnieuw. */
  async function herlaad() {
    const { model } = await API.loadModel();
    M = model;
    SEIZOEN = String((M.instellingen || {}).seizoen ||
      ((cfg.SEIZOEN || '').match(/\d{4}/) || [])[0] || new Date().getFullYear());
  }

  async function init() {
    const banner = $('banner');
    try {
      await herlaad();

      // Editors één keer vullen (daarna niet overschrijven wat iemand aan het typen is).
      $('ringnummers').value = M.duiven.map(d => d.ring_lang).join('\n');
      tekenDuiven();
      vulDeelnemers();
      $('duiven-per-team').value = Number(M.instellingen.duivenPerTeam) || Number(cfg.DUIVEN_PER_TEAM) || 8;

      banner.className = 'banner live';
      banner.textContent = 'Live · wijzigingen gaan direct naar de Google Sheet.';

      $('archiveer').addEventListener('click', archiveer);
      $('archief-url-opslaan').addEventListener('click', archiefUrlOpslaan);
      $('leeg').addEventListener('click', leeg);
      $('ringnummers').addEventListener('input', tekenDuiven);
      $('duiven-opslaan').addEventListener('click', duivenOpslaan);
      $('deelnemer-toevoegen').addEventListener('click', () => {
        const rij = maakDeelnemerRij('', true);
        $('deelnemers-lijst').append(rij);
        rij.querySelector('.naam-input').focus();
        telDeelnemers();
      });
      $('deelnemers-opslaan').addEventListener('click', deelnemersOpslaan);
      $('duiven-per-team').addEventListener('input', tekenStatus);
      $('instelling-opslaan').addEventListener('click', instellingOpslaan);
      $('reset-duiven').addEventListener('click', resetDuiven);

      tekenStatus();
    } catch (err) {
      banner.className = 'banner';
      melding('laad-fout', 'fout', 'Kon de gegevens niet laden: ' + esc(err.message));
    }
  }

  init();
})();
