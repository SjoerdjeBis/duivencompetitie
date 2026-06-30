/* duivenlijst.js — alle duiven in één sorteerbare tabel (naam, team, ringnummer, punten per etappe). */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  const $ = id => document.getElementById(id);

  let duiven = [];     // [{naam, ring_lang, ring_kort, teams[], perVlucht{}, totaal}]
  let etappes = [];    // [vluchtnr, ...]

  // Huidige sortering. sleutel: 'naam' | 'team' | 'kort' | 'lang' | 'totaal' | 'etappe:<nr>'
  let sortKey = 'totaal';
  let sortDir = -1;    // 1 = oplopend, -1 = aflopend

  /* ---------- Sorteren ---------- */
  function waarde(d, key) {
    if (key === 'naam') return (d.naam || '').toLowerCase();
    if (key === 'team') return (d.teams[0] || '').toLowerCase();
    if (key === 'kort') return num(d.ring_kort);
    if (key === 'lang') return (d.ring_lang || '');
    if (key === 'totaal') return d.totaal;
    if (key.startsWith('etappe:')) return d.perVlucht[Number(key.slice(7))] || 0;
    return '';
  }
  function num(s) { const n = Number(String(s).replace(/\D/g, '')); return isNaN(n) ? 0 : n; }

  function gesorteerd() {
    const arr = duiven.slice();
    arr.sort((a, b) => {
      const va = waarde(a, sortKey), vb = waarde(b, sortKey);
      let c;
      if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
      else c = String(va).localeCompare(String(vb), 'nl');
      if (c !== 0) return c * sortDir;
      // gelijke sleutel: altijd stabiel op naam (oplopend)
      return (a.naam || '').localeCompare(b.naam || '', 'nl');
    });
    return arr;
  }

  function setSort(key) {
    if (sortKey === key) { sortDir = -sortDir; }
    else {
      sortKey = key;
      // tekstkolommen standaard oplopend, getalkolommen aflopend
      sortDir = (key === 'naam' || key === 'team' || key === 'lang') ? 1 : -1;
    }
    render();
  }

  /* ---------- Renderen ---------- */
  function cel(tag, klasse, tekst) {
    const c = document.createElement(tag);
    if (klasse) c.className = klasse;
    if (tekst != null) c.textContent = tekst;
    return c;
  }

  function kopCel(key, klasse, label, titel) {
    const th = cel('th', 'sorteerbaar ' + (klasse || ''), null);
    if (titel) th.title = titel;
    const knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'sorteer-knop';
    knop.append(cel('span', 'kop-tekst', label));
    const pijl = cel('span', 'sorteer-pijl', sortKey === key ? (sortDir === 1 ? '▲' : '▼') : '');
    knop.append(pijl);
    if (sortKey === key) th.classList.add('actief');
    knop.addEventListener('click', () => setSort(key));
    th.append(knop);
    return th;
  }

  function kopRij() {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    tr.append(kopCel('naam', 'k-naam', 'Naam'));
    tr.append(kopCel('team', 'k-naam', 'Team'));
    tr.append(kopCel('kort', 'k-ring', 'Kort'));
    tr.append(kopCel('lang', 'k-ring', 'Ringnummer'));
    etappes.forEach((nr, i) => tr.append(kopCel('etappe:' + nr, 'k-etappe', String(i + 1),
      'Etappe ' + (i + 1) + ' (vlucht ' + nr + ')')));
    tr.append(kopCel('totaal', 'k-totaal', 'Tot'));
    thead.append(tr);
    return thead;
  }

  function duifRij(d) {
    const tr = document.createElement('tr');

    const tdNaam = cel('td', 'od-naam', d.naam || '(naamloos)');
    if (!d.naam) tdNaam.classList.add('naamloos');
    tr.append(tdNaam);

    const team = d.teams.join(', ');
    const tdTeam = cel('td', 'od-team', team || '—');
    if (!team) tdTeam.classList.add('naamloos');
    tr.append(tdTeam);

    tr.append(cel('td', 'od-ring', d.ring_kort || ''));
    tr.append(cel('td', 'od-ring', d.ring_lang || ''));

    etappes.forEach(nr => {
      const pts = d.perVlucht[nr] || 0;
      const td = cel('td', 'od-etappe', pts ? String(pts) : '');
      if (!pts) td.classList.add('nul');
      tr.append(td);
    });

    tr.append(cel('td', 'od-totaal', String(d.totaal)));
    return tr;
  }

  function render() {
    const inhoud = $('inhoud');
    inhoud.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';

    const h2 = document.createElement('h2');
    h2.append(cel('span', null, 'Alle duiven'));
    h2.append(cel('span', 'count', '· ' + duiven.length + (duiven.length === 1 ? ' duif' : ' duiven')));
    card.append(h2);

    if (!duiven.length) {
      card.append(cel('div', 'leeg', 'Nog geen duiven in de database.'));
      inhoud.append(card);
      return;
    }

    const scroll = document.createElement('div');
    scroll.className = 'tabel-scroll';
    const tabel = document.createElement('table');
    tabel.className = 'overzicht-tabel duivenlijst-tabel';
    tabel.append(kopRij());
    const tbody = document.createElement('tbody');
    gesorteerd().forEach(d => tbody.append(duifRij(d)));
    tabel.append(tbody);
    scroll.append(tabel);
    card.append(scroll);
    inhoud.append(card);
  }

  /* ---------- Init ---------- */
  async function init() {
    const banner = $('banner');
    try {
      const { model, live } = await API.loadModel();
      const pv = Scoring.duivenPerVlucht(model);
      etappes = pv.vluchten;
      duiven = pv.duiven;

      banner.className = 'banner' + (live ? ' live' : '');
      banner.innerHTML = live
        ? 'Live · gegevens uit de Google Sheet.'
        : 'Demo-modus · gebundelde voorbeelddata (stel API_URL in <code>config.js</code> in om live te gaan).';

      render();
    } catch (err) {
      banner.className = 'banner';
      $('inhoud').innerHTML = '';
      $('inhoud').append(cel('div', 'melding fout', 'Kon de duivenlijst niet laden: ' + err.message));
    }
  }

  init();
})();
