/* invoer.js — uitslag invoeren via de laatste 3 cijfers van het ringnummer. */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  const AANTAL = Number(cfg.AANTAL_POSITIES) || 25;
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';

  const $ = id => document.getElementById(id);
  let MODEL = null;

  /** Normaliseert getypte invoer naar een 3-cijferige korte code ("85" -> "085"). */
  function normCode(v) {
    const d = (v || '').replace(/\D/g, '').slice(-3);
    return d ? d.padStart(3, '0') : '';
  }

  /** Bouwt één invoerrij voor een positie. */
  function maakRij(pos) {
    const rij = document.createElement('div');
    rij.className = 'pos-rij';
    rij.dataset.pos = pos;

    const nr = document.createElement('div');
    nr.className = 'pos-nr';
    nr.textContent = pos;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.maxLength = 3;
    inp.placeholder = '–';
    inp.autocomplete = 'off';

    const res = document.createElement('div');
    res.className = 'resolved empty';

    inp.addEventListener('input', () => { resolveer(rij); checkDuplicaten(); });
    // Enter springt naar de volgende plek.
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = rij.nextElementSibling && rij.nextElementSibling.querySelector('input');
        if (next) next.focus();
      }
    });

    rij.append(nr, inp, res);
    return rij;
  }

  /** Werkt de naam/team-weergave van een rij bij. */
  function resolveer(rij) {
    const inp = rij.querySelector('input');
    const res = rij.querySelector('.resolved');
    const code = normCode(inp.value);
    rij.dataset.code = code;
    delete rij.dataset.override;

    res.innerHTML = '';
    if (!code) { res.className = 'resolved empty'; res.textContent = '–'; return; }

    const treffers = MODEL.byKort[code] || [];
    if (treffers.length === 1) {
      res.className = 'resolved ok';
      const d = treffers[0];
      res.append(document.createTextNode(d.naam + ' '));
      if (d.teams.length) {
        const t = document.createElement('span'); t.className = 'team';
        t.textContent = '· ' + d.teams.join(' · ');
        res.append(t);
      }
    } else if (treffers.length > 1) {
      // Botsing: twee duiven met dezelfde laatste 3 cijfers -> laat kiezen.
      res.className = 'resolved warn';
      const sel = document.createElement('select');
      sel.append(new Option('Kies welke duif…', ''));
      treffers.forEach(d => sel.append(new Option(d.naam + '  (' + d.ring_lang + ')', d.naam)));
      sel.addEventListener('change', () => { rij.dataset.override = sel.value; });
      res.append(document.createTextNode('Twee duiven op ' + code + ': '));
      res.append(sel);
    } else {
      // Onbekend ringnummer (bv. een reserve-duif die niemand koos).
      res.className = 'resolved warn';
      res.append(document.createTextNode('Onbekend (' + code + ') — '));
      const naam = document.createElement('input');
      naam.type = 'text'; naam.placeholder = 'naam (optioneel)';
      naam.style.cssText = 'font-size:.85rem;padding:4px 8px;width:160px;text-align:left;letter-spacing:normal';
      naam.addEventListener('input', () => { rij.dataset.override = naam.value.trim(); });
      res.append(naam);
    }
  }

  /** Markeert dubbel ingevoerde codes. */
  function checkDuplicaten() {
    const rijen = [...document.querySelectorAll('.pos-rij')];
    const tel = {};
    rijen.forEach(r => { const c = r.dataset.code; if (c) tel[c] = (tel[c] || 0) + 1; });
    rijen.forEach(r => r.classList.toggle('dup', !!r.dataset.code && tel[r.dataset.code] > 1));
    return Object.values(tel).some(n => n > 1);
  }

  function verzamel() {
    return [...document.querySelectorAll('.pos-rij')]
      .filter(r => r.dataset.code)
      .map(r => ({
        positie: Number(r.dataset.pos),
        ring_kort: r.dataset.code,
        naam_override: r.dataset.override || ''
      }));
  }

  function toonMelding(soort, tekst) {
    const m = $('melding');
    m.className = 'melding ' + soort;
    m.innerHTML = tekst;
  }

  async function verzend() {
    $('melding').innerHTML = '';
    const vlucht = Number($('vlucht').value);
    if (!vlucht) return toonMelding('fout', 'Vul een vluchtnummer in.');
    if (checkDuplicaten()) return toonMelding('fout', 'Er staan dubbele ringnummers in de uitslag — corrigeer de rood gemarkeerde plekken.');

    const finishers = verzamel();
    if (!finishers.length) return toonMelding('fout', 'Nog niets ingevuld.');

    const knop = $('verzend');
    knop.disabled = true; knop.textContent = 'Verzenden…';
    try {
      const overwrite = !!($('overschrijf') && $('overschrijf').checked);
      const res = await API.submitUitslag({ vlucht, finishers, overwrite });
      const aantal = (res && res.aantal) || finishers.length;
      const totaal = res && res.totaal;
      const extra = (totaal && totaal !== aantal)
        ? (' (' + aantal + ' toegevoegd, ' + totaal + ' in totaal voor deze vlucht)')
        : '';
      toonMelding('ok', '✓ Vlucht ' + vlucht + ' opgeslagen' + extra + '! Bekijk de ' +
        '<a href="./tussenstandopen.html" target="_blank" rel="noopener">tussenstand</a>.');
      if ($('overschrijf')) $('overschrijf').checked = false;
    } catch (err) {
      toonMelding('fout', 'Opslaan mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = 'Uitslag verzenden';
    }
  }

  function wis() {
    document.querySelectorAll('.pos-rij input').forEach(i => { i.value = ''; });
    document.querySelectorAll('.pos-rij').forEach(r => { delete r.dataset.code; delete r.dataset.override; resolveer(r); });
    checkDuplicaten();
    $('melding').innerHTML = '';
  }

  async function init() {
    const banner = $('banner');
    try {
      const { model, live } = await API.loadModel();
      MODEL = model;

      // Volgend vluchtnummer voorstellen.
      const maxNr = model.vluchten.reduce((m, v) => Math.max(m, v.nummer), 0);
      $('vlucht').value = maxNr + 1;

      banner.className = 'banner' + (live ? ' live' : '');
      if (live) {
        banner.textContent = 'Live · je uitslag wordt opgeslagen in de Google Sheet en de tussenstand werkt direct bij.';
      } else {
        banner.innerHTML = 'Demo-modus · je kunt invoeren oefenen, maar <strong>verzenden werkt nog niet</strong>. ' +
          'Stel API_URL in <code>config.js</code> in om echt op te slaan.';
        $('verzend').disabled = true;
      }

      const rijen = $('rijen');
      for (let p = 1; p <= AANTAL; p++) rijen.append(maakRij(p));

      $('verzend').addEventListener('click', verzend);
      $('wis').addEventListener('click', wis);
    } catch (err) {
      banner.className = 'banner';
      toonMelding('fout', 'Kon de duivenlijst niet laden: ' + err.message);
    }
  }

  init();
})();
