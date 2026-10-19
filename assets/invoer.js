/* invoer.js — uitslag invoeren via de laatste 3 cijfers van het ringnummer. */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  const AANTAL = Number(cfg.AANTAL_POSITIES) || 25;
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';

  const $ = id => document.getElementById(id);
  let MODEL = null;

  // Concept lokaal bewaren, zodat per ongeluk wegklikken je invoer niet wist.
  const CONCEPT_SLEUTEL = 'duiven_invoer_concept_v1';

  /** Bewaart de huidige invoer in de browser (localStorage). */
  function bewaarConcept() {
    try {
      const rijen = [...document.querySelectorAll('.pos-rij')]
        .map(r => ({
          pos: Number(r.dataset.pos),
          value: r.querySelector('input').value,
          override: r.dataset.override || ''
        }))
        .filter(r => r.value || r.override);
      const vlucht = $('vlucht').value;
      if (!rijen.length && !vlucht) { localStorage.removeItem(CONCEPT_SLEUTEL); return; }
      localStorage.setItem(CONCEPT_SLEUTEL, JSON.stringify({ vlucht, rijen, ts: Date.now() }));
    } catch (e) { /* localStorage niet beschikbaar — stil negeren */ }
  }

  /** Wist het bewaarde concept. */
  function wisConcept() {
    try { localStorage.removeItem(CONCEPT_SLEUTEL); } catch (e) {}
  }

  /** Herstelt een eerder bewaard concept in de al opgebouwde rijen. */
  function herstelConcept() {
    let data;
    try {
      const raw = localStorage.getItem(CONCEPT_SLEUTEL);
      if (!raw) return;
      data = JSON.parse(raw);
    } catch (e) { return; }
    if (!data || !data.rijen || !data.rijen.length) return;

    if (data.vlucht) $('vlucht').value = data.vlucht;
    data.rijen.forEach(saved => {
      const rij = document.querySelector('.pos-rij[data-pos="' + saved.pos + '"]');
      if (!rij) return;
      const inp = rij.querySelector('input');
      inp.value = saved.value || '';
      resolveer(rij);
      // Handmatige keuze/naam (botsing of onbekend ringnummer) terugzetten.
      if (saved.override) {
        rij.dataset.override = saved.override;
        const sub = rij.querySelector('.resolved select, .resolved input');
        if (sub) sub.value = saved.override;
      }
    });
    checkDuplicaten();

    const tijd = data.ts ? new Date(data.ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
    toonMelding('ok', '↩︎ Je eerdere invoer is hersteld' + (tijd ? ' (bewaard om ' + tijd + ')' : '') +
      '. Klik op <strong>Leegmaken</strong> om opnieuw te beginnen.');
  }

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

    inp.addEventListener('input', () => { resolveer(rij); checkDuplicaten(); bewaarConcept(); });
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
      res.append(document.createTextNode((d.naam || '(nog geen naam)') + ' '));
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
      // Waarde = lang ringnummer: dat is uniek (namen kunnen dubbel voorkomen).
      treffers.forEach(d => sel.append(new Option((d.naam || '(naamloos)') + '  (' + d.ring_lang + ')', d.ring_lang)));
      sel.addEventListener('change', () => { rij.dataset.override = sel.value; checkDuplicaten(); bewaarConcept(); });
      res.append(document.createTextNode('Twee duiven op ' + code + ': '));
      res.append(sel);
    } else {
      // Onbekend ringnummer (bv. een reserve-duif die niemand koos).
      res.className = 'resolved warn';
      res.append(document.createTextNode('Onbekend (' + code + ') — '));
      const naam = document.createElement('input');
      naam.type = 'text'; naam.placeholder = 'naam (optioneel)';
      naam.style.cssText = 'font-size:.85rem;padding:4px 8px;width:160px;text-align:left;letter-spacing:normal';
      naam.addEventListener('input', () => { rij.dataset.override = naam.value.trim(); bewaarConcept(); });
      res.append(naam);
    }
  }

  /** Sleutel van een rij: bij een botsing de gekozen duif (lang ringnummer), anders de code.
   *  Zo mogen twee verschillende duiven met dezelfde laatste 3 cijfers in één vlucht. */
  function duifSleutel(r) {
    const c = r.dataset.code;
    if (!c) return '';
    const botst = (MODEL.byKort[c] || []).length > 1;
    return botst ? (r.dataset.override || c) : c;
  }

  /** Markeert dubbel ingevoerde duiven. */
  function checkDuplicaten() {
    const rijen = [...document.querySelectorAll('.pos-rij')];
    const tel = {};
    rijen.forEach(r => { const k = duifSleutel(r); if (k) tel[k] = (tel[k] || 0) + 1; });
    rijen.forEach(r => { const k = duifSleutel(r); r.classList.toggle('dup', !!k && tel[k] > 1); });
    return Object.values(tel).some(n => n > 1);
  }

  /** Plekken met een botsende code waar nog niet gekozen is welke duif het is. */
  function onbeslisteBotsingen() {
    return [...document.querySelectorAll('.pos-rij')]
      .filter(r => r.dataset.code && (MODEL.byKort[r.dataset.code] || []).length > 1 && !r.dataset.override)
      .map(r => r.dataset.pos);
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
    const open = onbeslisteBotsingen();
    if (open.length) return toonMelding('fout', 'Kies bij plek ' + open.join(', ') + ' welke duif bedoeld is ' +
      '(er zijn meerdere duiven met dezelfde laatste 3 cijfers).');
    if (checkDuplicaten()) return toonMelding('fout', 'Er staat een duif dubbel in de uitslag — corrigeer de rood gemarkeerde plekken.');

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
      wisConcept();
      await herlaadEtappes();
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
    wisConcept();
  }

  /* ---------- Ingevoerde etappes: bekijken, wijzigen, verwijderen ---------- */

  async function herlaadEtappes() {
    try {
      const { model } = await API.loadModel();
      MODEL = model;
      tekenEtappes();
    } catch (e) { /* lijst blijft zoals hij was */ }
  }

  function tekenEtappes() {
    const box = $('etappes');
    box.innerHTML = '';
    const vl = MODEL.vluchten;
    $('etappes-telling').textContent = vl.length ? '(' + vl.length + ')' : '';
    if (!vl.length) {
      box.append(Object.assign(document.createElement('div'), { className: 'leeg', textContent: 'Nog geen etappes ingevoerd.' }));
      return;
    }
    vl.slice().reverse().forEach(v => {
      const rij = document.createElement('div');
      rij.className = 'etappe-rij';
      const top = v.finishers.slice(0, 3).map(f => {
        const d = Scoring.resolveDuif(MODEL, f);
        return f.positie + '. ' + (d.naam || f.ring_kort);
      }).join(' · ');
      const tekst = document.createElement('div');
      tekst.className = 'etappe-tekst';
      const kop = document.createElement('strong');
      kop.textContent = 'Vlucht ' + v.nummer;
      const sub = document.createElement('span');
      sub.textContent = v.finishers.length + ' plekken · ' + top;
      tekst.append(kop, sub);
      const wijzig = Object.assign(document.createElement('button'), { type: 'button', className: 'ghost', textContent: 'Wijzig' });
      const weg = Object.assign(document.createElement('button'), { type: 'button', className: 'ghost gevaar', textContent: 'Verwijder' });
      wijzig.addEventListener('click', () => laadInFormulier(v));
      weg.addEventListener('click', () => verwijderEtappe(v, weg));
      rij.append(tekst, wijzig, weg);
      box.append(rij);
    });
  }

  /** Zet een bestaande vlucht in het formulier, met "vervangen" aangevinkt. */
  function laadInFormulier(v) {
    const ingevuld = [...document.querySelectorAll('.pos-rij input')].some(i => i.value);
    if (ingevuld && !window.confirm('Het formulier is niet leeg. Overschrijven met vlucht ' + v.nummer + '?')) return;
    wis();
    $('vlucht').value = v.nummer;
    v.finishers.forEach(f => {
      const rij = document.querySelector('.pos-rij[data-pos="' + f.positie + '"]');
      if (!rij) return;
      rij.querySelector('input').value = f.ring_kort;
      resolveer(rij);
      if (f.naam_override) {
        rij.dataset.override = f.naam_override;
        const sub = rij.querySelector('.resolved select, .resolved input');
        if (sub) sub.value = f.naam_override;
      }
    });
    checkDuplicaten();
    $('overschrijf').checked = true;
    bewaarConcept();
    toonMelding('ok', 'Vlucht ' + v.nummer + ' staat in het formulier. Pas aan en klik op ' +
      '<strong>Uitslag verzenden</strong>; "vervangen" staat al aan.');
    $('vlucht').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function verwijderEtappe(v, knop) {
    if (!window.confirm('Vlucht ' + v.nummer + ' (' + v.finishers.length + ' plekken) helemaal verwijderen?\n\n' +
        'De punten van deze etappe verdwijnen uit de stand.')) return;
    knop.disabled = true; knop.textContent = 'Verwijderen…';
    try {
      await API.verwijderVlucht({ vlucht: v.nummer });
      toonMelding('ok', '✓ Vlucht ' + v.nummer + ' is verwijderd.');
      await herlaadEtappes();
    } catch (err) {
      toonMelding('fout', 'Verwijderen mislukt: ' + err.message);
      knop.disabled = false; knop.textContent = 'Verwijder';
    }
  }

  async function init() {
    const banner = $('banner');
    try {
      const { model } = await API.loadModel();
      MODEL = model;

      // Volgend vluchtnummer voorstellen.
      const maxNr = model.vluchten.reduce((m, v) => Math.max(m, v.nummer), 0);
      $('vlucht').value = maxNr + 1;

      banner.className = 'banner live';
      banner.textContent = 'Live · je uitslag wordt opgeslagen in de Google Sheet en de tussenstand werkt direct bij.';

      const rijen = $('rijen');
      for (let p = 1; p <= AANTAL; p++) rijen.append(maakRij(p));

      $('verzend').addEventListener('click', verzend);
      $('wis').addEventListener('click', wis);
      $('vlucht').addEventListener('input', bewaarConcept);

      // Eerder (per ongeluk) verlaten invoer terugzetten.
      herstelConcept();
      tekenEtappes();
    } catch (err) {
      banner.className = 'banner';
      toonMelding('fout', 'Kon de duivenlijst niet laden: ' + err.message);
    }
  }

  init();
})();
