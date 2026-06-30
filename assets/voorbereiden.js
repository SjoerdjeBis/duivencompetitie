/* voorbereiden.js — seizoensstart: deelnemers + duiven (lange ringnummers) klaarzetten. */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';

  const $ = id => document.getElementById(id);
  let LIVE = false;

  /* ---------- Deelnemers ---------- */

  function maakDeelnemerRij(naam, meedoet) {
    const rij = document.createElement('div');
    rij.className = 'deelnemer-rij';

    const vink = document.createElement('input');
    vink.type = 'checkbox';
    vink.checked = meedoet !== false;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'naam-input';
    inp.value = naam || '';
    inp.placeholder = 'Naam deelnemer';
    inp.autocomplete = 'off';

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'verwijder';
    weg.title = 'Verwijderen';
    weg.textContent = '×';

    function sync() { rij.classList.toggle('uit', !vink.checked); telDeelnemers(); }
    vink.addEventListener('change', sync);
    inp.addEventListener('input', telDeelnemers);
    weg.addEventListener('click', () => { rij.remove(); telDeelnemers(); });

    rij.append(vink, inp, weg);
    rij.classList.toggle('uit', !vink.checked);
    return rij;
  }

  function leesDeelnemers() {
    const namen = [];
    const seen = new Set();
    [...document.querySelectorAll('.deelnemer-rij')].forEach(rij => {
      const vink = rij.querySelector('input[type=checkbox]');
      const naam = rij.querySelector('.naam-input').value.trim();
      if (!vink.checked || !naam) return;
      const key = naam.toLowerCase();
      if (seen.has(key)) return;     // dubbele namen ontdubbelen
      seen.add(key);
      namen.push(naam);
    });
    return namen;
  }

  function telDeelnemers() {
    const n = leesDeelnemers().length;
    $('deelnemers-telling').textContent = n + (n === 1 ? ' doet mee' : ' doen mee');
  }

  /* ---------- Duiven ---------- */

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

    // Botsingen op korte code opsporen.
    const perKort = {};
    duiven.forEach(d => (perKort[d.ring_kort] = perKort[d.ring_kort] || []).push(d));
    const botsKorts = new Set(Object.keys(perKort).filter(k => perKort[k].length > 1));

    duiven.forEach(d => {
      const chip = document.createElement('span');
      chip.className = 'ring-chip' + (botsKorts.has(d.ring_kort) ? ' bots' : '');
      chip.innerHTML = '<span class="lang">' + d.ring_lang + '</span>' +
        '<span class="kort">' + d.ring_kort + '</span>';
      preview.append(chip);
    });

    $('duiven-telling').textContent = duiven.length
      ? duiven.length + (duiven.length === 1 ? ' duif' : ' duiven') : '';

    const w = $('duiven-waarschuwing');
    if (botsKorts.size) {
      const namen = [...botsKorts].join(', ');
      w.className = 'melding fout';
      w.innerHTML = '⚠ Let op: meerdere duiven eindigen op dezelfde 3 cijfers (' + namen +
        '). Bij het invoeren van uitslagen moet er dan elke keer gekozen worden welke ' +
        'duif bedoeld is. Dat mag, maar check of het klopt.';
    } else {
      w.className = ''; w.innerHTML = '';
    }
    return duiven;
  }

  /* ---------- Opslaan / kopiëren ---------- */

  function melding(soort, tekst) {
    const m = $('melding');
    m.className = 'melding ' + soort;
    m.innerHTML = tekst;
  }

  function verzamel() {
    return { deelnemers: leesDeelnemers(), duiven: leesDuiven() };
  }

  function valideer(data) {
    if (!data.deelnemers.length) { melding('fout', 'Er doet nog geen enkele deelnemer mee.'); return false; }
    if (!data.duiven.length) { melding('fout', 'Er zijn nog geen duiven (lange ringnummers) ingevoerd.'); return false; }
    return true;
  }

  async function opslaan() {
    $('melding').innerHTML = '';
    const data = verzamel();
    if (!valideer(data)) return;

    const wis = $('wis-uitslagen').checked;
    const bevestig = 'Dit vervangt de huidige deelnemers- en duivenlijst' +
      (wis ? ' én wist alle bestaande uitslagen' : '') +
      '.\n\n' + data.deelnemers.length + ' deelnemers, ' + data.duiven.length +
      ' duiven.\n\nDoorgaan?';
    if (!window.confirm(bevestig)) return;

    const knop = $('opslaan');
    knop.disabled = true; knop.textContent = 'Opslaan…';
    try {
      const res = await API.saveSeizoen({
        deelnemers: data.deelnemers,
        duiven: data.duiven,
        wisUitslagen: wis
      });
      melding('ok', '✓ Seizoen opgeslagen: ' + res.deelnemers + ' deelnemers en ' +
        res.duiven + ' duiven staan klaar in de Google Sheet.');
    } catch (err) {
      melding('fout', 'Opslaan mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = 'Seizoen opslaan';
    }
  }

  async function naarKlembord(tekst, wat) {
    try {
      await navigator.clipboard.writeText(tekst);
      melding('ok', '✓ ' + wat + ' gekopieerd — plak het in het juiste tabblad van je Sheet (cel A2).');
    } catch (err) {
      melding('fout', 'Kopiëren lukte niet: ' + err.message);
    }
  }

  function kopieerDeelnemers() {
    const namen = leesDeelnemers();
    if (!namen.length) return melding('fout', 'Er doet nog geen deelnemer mee.');
    naarKlembord(namen.join('\n'), namen.length + ' deelnemers');
  }

  function instellingMelding(soort, tekst) {
    const m = $('instelling-melding');
    m.className = 'melding ' + soort;
    m.innerHTML = tekst;
  }

  async function instellingOpslaan() {
    const n = Math.max(1, Number($('duiven-per-team').value) || 0);
    if (!n) { instellingMelding('fout', 'Vul een geldig aantal in.'); return; }
    const knop = $('instelling-opslaan');
    knop.disabled = true; const oud = knop.textContent; knop.textContent = 'Opslaan…';
    try {
      await API.setInstellingen({ duivenPerTeam: n });
      instellingMelding('ok', '✓ Opgeslagen: ' + n + ' duiven per team.');
    } catch (err) {
      instellingMelding('fout', 'Opslaan mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = oud;
    }
  }

  async function resetDuiven() {
    if (!window.confirm('Alle duiven teamloos maken?\n\n' +
        'Dit wist bij élke duif de naam én het team in de Google Sheet. ' +
        'De ringnummers en de uitslagen blijven staan.\n\nDoorgaan?')) return;
    const knop = $('reset-duiven');
    knop.disabled = true; const oud = knop.textContent; knop.textContent = 'Resetten…';
    try {
      const res = await API.resetDuiven();
      melding('ok', '✓ ' + res.duiven + ' duiven zijn teamloos gemaakt. ' +
        'Je kunt nu het keuzemoment opnieuw doen.');
    } catch (err) {
      melding('fout', 'Resetten mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = oud;
    }
  }

  function kopieerDuiven() {
    const duiven = leesDuiven();
    if (!duiven.length) return melding('fout', 'Er zijn nog geen duiven ingevoerd.');
    // TSV in kolomvolgorde van Duivendatabase: naam, ring_lang, ring_kort, teams (naam/teams leeg).
    const tsv = duiven.map(d => ['', d.ring_lang, d.ring_kort, ''].join('\t')).join('\n');
    naarKlembord(tsv, duiven.length + ' duiven');
  }

  /* ---------- Init ---------- */

  async function init() {
    const banner = $('banner');
    try {
      const { model, live } = await API.loadModel();
      LIVE = live;

      // Vorig jaar als startpunt (alle deelnemers aangevinkt), alfabetisch voor het overzicht.
      const vorig = ((model.deelnemers && model.deelnemers.length)
        ? model.deelnemers : [...model.roster]).slice().sort((a, b) => a.localeCompare(b, 'nl'));
      const lijst = $('deelnemers-lijst');
      vorig.forEach(naam => lijst.append(maakDeelnemerRij(naam, true)));
      if (!vorig.length) lijst.append(maakDeelnemerRij('', true));
      telDeelnemers();

      // Keuzemoment-instelling voorvullen (Sheet > config-default).
      const inst = model.instellingen || {};
      $('duiven-per-team').value = Number(inst.duivenPerTeam) || Number(cfg.DUIVEN_PER_TEAM) || 8;

      banner.className = 'banner' + (live ? ' live' : '');
      if (live) {
        banner.textContent = 'Live · opslaan schrijft direct naar de Google Sheet.';
      } else {
        banner.innerHTML = 'Demo-modus · <strong>opslaan werkt nog niet</strong> ' +
          '(stel API_URL in <code>config.js</code> in). Je kunt wel alvast invullen en ' +
          'de lijsten kopiëren naar je Sheet.';
        $('opslaan').disabled = true;
        $('reset-duiven').disabled = true;
        $('instelling-opslaan').disabled = true;
        $('demo-kopie').style.display = '';   // kopieerknoppen alleen in demo
      }

      $('deelnemer-toevoegen').addEventListener('click', () => {
        const rij = maakDeelnemerRij('', true);
        $('deelnemers-lijst').append(rij);
        rij.querySelector('.naam-input').focus();
        telDeelnemers();
      });
      $('ringnummers').addEventListener('input', tekenDuiven);
      $('opslaan').addEventListener('click', opslaan);
      $('kopieer-deelnemers').addEventListener('click', kopieerDeelnemers);
      $('kopieer-duiven').addEventListener('click', kopieerDuiven);
      $('reset-duiven').addEventListener('click', resetDuiven);
      $('instelling-opslaan').addEventListener('click', instellingOpslaan);
    } catch (err) {
      banner.className = 'banner';
      melding('fout', 'Kon de gegevens niet laden: ' + err.message);
    }
  }

  init();
})();
