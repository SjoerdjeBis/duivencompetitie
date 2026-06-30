/* overzicht.js — duiven per team met punten per etappe; naam wijzigen of uit team halen. */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  const $ = id => document.getElementById(id);

  let LIVE = false;
  let duiven = [];        // [{naam, ring_lang, ring_kort, teams[], perVlucht{}, totaal}]
  let etappes = [];       // [vluchtnr, ...]
  let teamVolgorde = [];  // teamnamen in klassementsvolgorde (beste eerst)
  let modalDuif = null;   // duif die in de naam-modal bewerkt wordt

  /* ---------- Data groeperen ---------- */
  function teamsMetDuiven() {
    return teamVolgorde.map(team => {
      const eigen = duiven
        .filter(d => d.teams.indexOf(team) >= 0)
        .sort((a, b) => b.totaal - a.totaal || (a.naam || '').localeCompare(b.naam || '', 'nl'));
      const totaal = eigen.reduce((s, d) => s + d.totaal, 0);
      return { team, duiven: eigen, totaal };
    });
  }

  /* ---------- Renderen ---------- */
  function render() {
    const inhoud = $('inhoud');
    inhoud.innerHTML = '';
    const groepen = teamsMetDuiven();
    if (!groepen.length) {
      inhoud.innerHTML = '<div class="card"><div class="leeg">Nog geen teams of duiven.</div></div>';
      return;
    }
    groepen.forEach(g => inhoud.append(teamKaart(g)));
  }

  function cel(tag, klasse, tekst) {
    const c = document.createElement(tag);
    if (klasse) c.className = klasse;
    if (tekst != null) c.textContent = tekst;
    return c;
  }

  function teamKaart(g) {
    const card = document.createElement('div');
    card.className = 'card';

    const h2 = document.createElement('h2');
    h2.append(cel('span', null, g.team));
    h2.append(cel('span', 'count', '· ' + g.duiven.length + (g.duiven.length === 1 ? ' duif' : ' duiven')));
    h2.append(cel('span', 'team-totaal', g.totaal + ' pt'));
    card.append(h2);

    if (!g.duiven.length) {
      card.append(cel('div', 'leeg', 'Nog geen duiven gekozen voor dit team.'));
      return card;
    }

    const scroll = document.createElement('div');
    scroll.className = 'tabel-scroll';
    const tabel = document.createElement('table');
    tabel.className = 'overzicht-tabel';
    tabel.append(kopRij());
    const tbody = document.createElement('tbody');
    g.duiven.forEach(d => tbody.append(duifRij(d, g.team)));
    tabel.append(tbody);
    scroll.append(tabel);
    card.append(scroll);
    return card;
  }

  function kopRij() {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    tr.append(cel('th', 'k-naam', 'Duif'));
    tr.append(cel('th', 'k-ring', 'Ringnummer'));
    etappes.forEach((nr, i) => {
      const th = cel('th', 'k-etappe', String(i + 1));
      th.title = 'Etappe ' + (i + 1) + ' (vlucht ' + nr + ')';
      tr.append(th);
    });
    tr.append(cel('th', 'k-totaal', 'Tot'));
    tr.append(cel('th', 'k-actie', ''));
    thead.append(tr);
    return thead;
  }

  function duifRij(d, team) {
    const tr = document.createElement('tr');

    const tdNaam = cel('td', 'od-naam', d.naam || '(naamloos)');
    if (!d.naam) tdNaam.classList.add('naamloos');
    tr.append(tdNaam);

    tr.append(cel('td', 'od-ring', d.ring_lang || ''));

    etappes.forEach(nr => {
      const pts = d.perVlucht[nr] || 0;
      const td = cel('td', 'od-etappe', pts ? String(pts) : '');
      if (!pts) td.classList.add('nul');
      tr.append(td);
    });

    tr.append(cel('td', 'od-totaal', String(d.totaal)));

    const tdActie = cel('td', 'od-actie');
    const knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'wijzig-knop';
    knop.title = 'Wijzigen';
    knop.setAttribute('aria-label', 'Wijzigen');
    knop.textContent = '✏️';
    knop.addEventListener('click', e => { e.stopPropagation(); openActieMenu(knop, d, team); });
    tdActie.append(knop);
    tr.append(tdActie);

    return tr;
  }

  /* ---------- Actie-menu (naam veranderen / uit team) ---------- */
  let openMenu = null;
  function sluitMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('click', buitenKlik); }
  }
  function buitenKlik(e) { if (openMenu && !openMenu.contains(e.target)) sluitMenu(); }

  function openActieMenu(anchor, d, team) {
    sluitMenu();
    const m = document.createElement('div');
    m.className = 'actie-menu';

    const naamKnop = document.createElement('button');
    naamKnop.type = 'button';
    naamKnop.textContent = '✏️  Naam veranderen';
    naamKnop.addEventListener('click', () => { sluitMenu(); openNaamModal(d); });

    const wegKnop = document.createElement('button');
    wegKnop.type = 'button';
    wegKnop.className = 'gevaar';
    wegKnop.textContent = '✖  Uit team ' + team + ' halen';
    wegKnop.addEventListener('click', () => { sluitMenu(); verwijderUitTeam(d, team); });

    m.append(naamKnop, wegKnop);
    document.body.append(m);

    const r = anchor.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 6) + 'px';
    m.style.left = (window.scrollX + r.right - m.offsetWidth) + 'px';
    openMenu = m;
    setTimeout(() => document.addEventListener('click', buitenKlik), 0);
  }

  /* ---------- Naam-modal ---------- */
  function openNaamModal(d) {
    modalDuif = d;
    $('wz-kort').textContent = d.ring_kort;
    $('wz-lang').textContent = d.ring_lang || '';
    const inp = $('wz-naam');
    inp.value = d.naam || '';
    inp.classList.remove('leeg-fout');
    $('wijzig-overlay').classList.remove('verborgen');
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  }
  function sluitNaamModal() {
    $('wijzig-overlay').classList.add('verborgen');
    modalDuif = null;
  }

  async function bevestigNaam() {
    if (!modalDuif) return;
    const naam = $('wz-naam').value.trim();
    if (!naam) { $('wz-naam').classList.add('leeg-fout'); $('wz-naam').focus(); return; }
    const d = modalDuif;
    if (naam === d.naam) { sluitNaamModal(); return; }

    const knop = $('wz-ok'); knop.disabled = true; const oud = knop.textContent; knop.textContent = 'Opslaan…';
    try {
      if (LIVE) await API.hernoemDuif({ ring_lang: d.ring_lang, naam: naam });
      d.naam = naam;
      sluitNaamModal();
      render();
    } catch (err) {
      alert('Naam opslaan mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = oud;
    }
  }

  /* ---------- Uit team halen ---------- */
  async function verwijderUitTeam(d, team) {
    const naam = d.naam || 'deze duif (' + d.ring_kort + ')';
    if (!window.confirm('"' + naam + '" uit team ' + team + ' halen?\n\n' +
        'De duif blijft bestaan; alleen de koppeling met dit team verdwijnt.')) return;
    try {
      if (LIVE) await API.verwijderUitTeam({ ring_lang: d.ring_lang, team: team });
      d.teams = d.teams.filter(t => t !== team);
      render();
    } catch (err) {
      alert('Verwijderen mislukt: ' + err.message);
    }
  }

  /* ---------- Init ---------- */
  async function init() {
    const banner = $('banner');
    try {
      const { model, live } = await API.loadModel();
      LIVE = live;
      const pv = Scoring.duivenPerVlucht(model);
      etappes = pv.vluchten;
      duiven = pv.duiven;
      teamVolgorde = Scoring.computeStandings(model).klassement.map(r => r.deelnemer);
      if (!teamVolgorde.length) teamVolgorde = [...model.roster];

      banner.className = 'banner' + (live ? ' live' : '');
      banner.innerHTML = live
        ? 'Live · wijzigingen worden direct in de Google Sheet vastgelegd.'
        : 'Demo-modus · je kunt hier oefenen, maar wijzigingen worden <strong>niet</strong> ' +
          'opgeslagen (stel API_URL in <code>config.js</code> in om live te gaan).';

      render();

      $('wz-ok').addEventListener('click', bevestigNaam);
      $('wz-annuleer').addEventListener('click', sluitNaamModal);
      $('wz-naam').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); bevestigNaam(); } });
      $('wijzig-overlay').addEventListener('click', e => { if (e.target === $('wijzig-overlay')) sluitNaamModal(); });
    } catch (err) {
      banner.className = 'banner';
      $('inhoud').innerHTML = '';
      $('inhoud').append(cel('div', 'melding fout', 'Kon het overzicht niet laden: ' + err.message));
    }
  }

  init();
})();
