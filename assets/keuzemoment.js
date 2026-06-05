/* keuzemoment.js — de draft: teams kiezen om beurten duiven (zelf of willekeurig). */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /** Korte helper rond de Web Animations API; geeft een promise terug. */
  const anim = (el, frames, opts) =>
    el.animate(frames, Object.assign({ duration: 600, fill: 'forwards', easing: 'ease' }, opts)).finished;

  let LIVE = false;
  const state = {
    order: [],          // teamnamen in draft-volgorde (slechtste eerst)
    perTeam: 8,         // richtgetal
    available: [],      // [{ring_lang, ring_kort}]
    takenByTeam: {},    // team -> [{ring_kort, ring_lang, naam}]
    idx: 0,             // welk team is aan de beurt
    methode: null,      // 'zelf' | 'willekeurig'
    bezig: false,       // animatie loopt
    pendingNaam: null   // callback wanneer naam is ingevuld
  };

  /* ============ Schermwissels ============ */
  function toon(schermId) {
    ['scherm-opzet', 'scherm-beurt', 'scherm-klaar'].forEach(id =>
      $(id).classList.toggle('verborgen', id !== schermId));
  }

  /* ============ 1. Opzet ============ */
  function maakOpzetRij(naam) {
    const li = document.createElement('li');
    li.dataset.team = naam;
    const grijp = document.createElement('span'); grijp.className = 'volg-nr';
    const label = document.createElement('span'); label.className = 'volg-naam'; label.textContent = naam;
    const knoppen = document.createElement('span'); knoppen.className = 'volg-knoppen';
    const op = document.createElement('button'); op.type = 'button'; op.textContent = '▲'; op.title = 'omhoog';
    const neer = document.createElement('button'); neer.type = 'button'; neer.textContent = '▼'; neer.title = 'omlaag';
    op.addEventListener('click', () => { const p = li.previousElementSibling; if (p) li.parentNode.insertBefore(li, p); nummerOpzet(); });
    neer.addEventListener('click', () => { const n = li.nextElementSibling; if (n) li.parentNode.insertBefore(n, li); nummerOpzet(); });
    knoppen.append(op, neer);
    li.append(grijp, label, knoppen);
    return li;
  }
  function nummerOpzet() {
    const rijen = [...$('opzet-volgorde').children];
    rijen.forEach((li, i) => { li.querySelector('.volg-nr').textContent = (i + 1); });
    $('opzet-telling').textContent = rijen.length + ' teams';
  }

  /* ============ 2. Beurt ============ */
  function huidigTeam() { return state.order[state.idx]; }

  function beginTeam() {
    if (state.idx >= state.order.length) return klaar();
    const team = huidigTeam();
    state.methode = null;
    $('beurt-team').textContent = team;
    $('beurt-positie').textContent = '(' + (state.idx + 1) + ' / ' + state.order.length + ')';
    $('picks-team').textContent = team;

    $('methode-keuze').classList.remove('verborgen');
    $('paneel-zelf').classList.add('verborgen');
    $('paneel-willekeurig').classList.add('verborgen');
    $('methode-vraag').textContent = 'Hoe wil ' + team + ' kiezen?';

    rendarPicks();
  }

  function kiesMethode(m) {
    state.methode = m;
    $('methode-keuze').classList.add('verborgen');
    if (m === 'zelf') {
      $('paneel-zelf').classList.remove('verborgen');
      rendarZelfGrid();
    } else {
      $('paneel-willekeurig').classList.remove('verborgen');
      vulKom();
      resetAnimatie();
    }
  }

  function voortgangTekst() {
    const n = (state.takenByTeam[huidigTeam()] || []).length;
    return 'gekozen ' + n + ' / richtgetal ' + state.perTeam;
  }

  function rendarPicks() {
    const team = huidigTeam();
    const picks = state.takenByTeam[team] || [];
    $('picks-telling').textContent = picks.length ? '(' + picks.length + ')' : '';
    $('beurt-voortgang').textContent = voortgangTekst();
    const ul = $('team-picks');
    ul.innerHTML = '';
    if (!picks.length) {
      const li = document.createElement('li'); li.className = 'leeg-regel';
      li.textContent = 'Nog geen duiven gekozen.'; ul.append(li); return;
    }
    picks.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="pick-naam">' + escapeHtml(p.naam || '(naamloos)') + '</span>' +
        '<span class="pick-ring">' + p.ring_kort + (p.ring_lang ? ' · ' + p.ring_lang : '') + '</span>';
      ul.append(li);
    });
  }

  /* ---- Zelf kiezen ---- */
  function rendarZelfGrid() {
    const grid = $('zelf-grid');
    grid.innerHTML = '';
    $('zelf-telling').textContent = '(' + state.available.length + ')';
    state.available.slice().sort((a, b) => a.ring_kort.localeCompare(b.ring_kort)).forEach(d => {
      const knop = document.createElement('button');
      knop.type = 'button'; knop.className = 'nummer-knop';
      knop.innerHTML = '<span class="nk">' + d.ring_kort + '</span>' +
        '<span class="nl">' + d.ring_lang + '</span>';
      knop.addEventListener('click', () => vraagNaam(d, () => {
        // grid bijwerken gebeurt in commitPick -> rendarZelfGrid
      }));
      grid.append(knop);
    });
    if (!state.available.length) {
      grid.innerHTML = '<div class="leeg">De kom is leeg — alle duiven zijn gekozen.</div>';
    }
  }

  /* ---- Willekeurig: de glazen kom ---- */
  function vulKom() {
    const wrap = $('kom-eieren');
    if (wrap.childElementCount) return; // eenmalig
    const kleuren = ['#fff', '#fdf6e3', '#f3ead3', '#f7e9e1', '#eef3ea'];
    // Plaats eieren binnen een ellips (de bolle binnenkant van de kom), onderin geclusterd.
    const cx = 50, cy = 64, rx = 33, ry = 28;
    let i = 0, pogingen = 0;
    while (i < 26 && pogingen < 400) {
      pogingen++;
      const x = cx + (Math.random() * 2 - 1) * rx;
      const y = cy + (Math.random() * 2 - 1) * ry;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;     // buiten de ellips -> overslaan
      const ei = document.createElement('div');
      ei.className = 'kom-ei';
      ei.style.left = x + '%';
      ei.style.top = y + '%';
      ei.style.setProperty('--rot', (Math.random() * 50 - 25) + 'deg');
      ei.style.background = 'radial-gradient(ellipse at 35% 30%, #fff, ' + kleuren[i % kleuren.length] + ' 70%)';
      ei.style.zIndex = Math.round(y);
      wrap.append(ei);
      i++;
    }
  }

  function resetAnimatie() {
    const ei = $('vlieg-ei'), kaart = $('nummer-kaart'), duif = $('duif');
    [ei, kaart].forEach(el => { el.classList.add('verborgen'); el.getAnimations().forEach(a => a.cancel()); el.style.transform = ''; el.style.opacity = ''; });
    ei.querySelectorAll('.dop').forEach(d => { d.getAnimations().forEach(a => a.cancel()); d.style.transform = ''; d.style.opacity = ''; });
    duif.getAnimations().forEach(a => a.cancel());
    duif.style.transform = 'translate(-150px,-70px) rotate(-15deg)';
    duif.style.opacity = '0';
    $('kies-knop').disabled = false;
  }

  async function trekEi() {
    if (state.bezig) return;
    if (!state.available.length) { rendarPicks(); return; }
    state.bezig = true;
    $('kies-knop').disabled = true;

    // Kies (echt) een willekeurige beschikbare duif.
    const keuze = state.available[Math.floor(Math.random() * state.available.length)];

    const duif = $('duif'), ei = $('vlieg-ei'), kaart = $('nummer-kaart');
    resetAnimatie();

    // 1) Duif vliegt in, boven de kom.
    await anim(duif, [
      { transform: 'translate(-150px,-70px) rotate(-15deg)', opacity: 0 },
      { transform: 'translate(0,-150px) rotate(0deg)', opacity: 1 }
    ], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' });

    // 2) Duik in de kom (pakt een ei).
    await anim(duif, [
      { transform: 'translate(0,-150px) rotate(0)' },
      { transform: 'translate(6px,-70px) rotate(8deg)' }
    ], { duration: 420, easing: 'cubic-bezier(.5,0,.7,.4)' });
    await sleep(120);

    // 3) Ei verschijnt bij de snavel; duif tilt het op uit de kom.
    ei.classList.remove('verborgen');
    ei.style.opacity = '1';
    ei.animate([{ transform: 'translateY(-150px) scale(.7)' }, { transform: 'translateY(-180px) scale(.85)' }],
      { duration: 1, fill: 'forwards' });
    await Promise.all([
      anim(duif, [
        { transform: 'translate(6px,-70px) rotate(8deg)' },
        { transform: 'translate(0,-205px) rotate(-4deg)' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }),
      anim(ei, [
        { transform: 'translateY(-180px) scale(.85)' },
        { transform: 'translateY(-235px) scale(.95)' }
      ], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' })
    ]);
    await sleep(180);

    // 4) Duif laat het ei vallen (zwaartekracht), en wappert weg.
    anim(duif, [
      { transform: 'translate(0,-205px) rotate(-4deg)' },
      { transform: 'translate(60px,-250px) rotate(12deg)', opacity: 1, offset: .6 },
      { transform: 'translate(150px,-150px) rotate(18deg)', opacity: 0 }
    ], { duration: 900, easing: 'ease-in' });

    await anim(ei, [
      { transform: 'translateY(-235px) scale(.95)' },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 540, easing: 'cubic-bezier(.45,0,.9,.55)' }); // valt: versnelt

    // 5) Landing: kleine squash, dan barst het ei open.
    await anim(ei, [
      { transform: 'translateY(0) scaleY(1) scaleX(1)' },
      { transform: 'translateY(6px) scaleY(.78) scaleX(1.18)' },
      { transform: 'translateY(0) scaleY(1) scaleX(1)' }
    ], { duration: 260, easing: 'ease-out' });

    // Vul de kaart al (zit nog verborgen "in" het ei).
    $('nk-kort').textContent = keuze.ring_kort;
    $('nk-lang').textContent = keuze.ring_lang;

    const boven = ei.querySelector('.dop.boven');
    const onder = ei.querySelector('.dop.onder');
    sparkle($('podium'));
    await Promise.all([
      anim(boven, [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(-26px,-34px) rotate(-55deg)', opacity: 0 }
      ], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }),
      anim(onder, [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(24px,22px) rotate(46deg)', opacity: 0 }
      ], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }),
      anim(ei.querySelector('.ei-glans'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 })
    ]);

    // 6) Het nummer ploft tevoorschijn.
    kaart.classList.remove('verborgen');
    await anim(kaart, [
      { transform: 'translateY(10px) scale(.2)', opacity: 0 },
      { transform: 'translateY(-6px) scale(1.12)', opacity: 1, offset: .7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 }
    ], { duration: 520, easing: 'cubic-bezier(.2,1.3,.4,1)' });

    await sleep(550);
    state.bezig = false;
    vraagNaam(keuze, null, true); // true = nummer is al onthuld
  }

  function sparkle(host) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'vonk';
      const a = (i / 10) * Math.PI * 2;
      const dist = 40 + Math.random() * 36;
      s.style.setProperty('--dx', Math.cos(a) * dist + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * dist - 10) + 'px');
      host.append(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  /* ---- Naam geven (gedeeld) ---- */
  function vraagNaam(duif, _onskip, alOnthuld) {
    $('mn-kort').textContent = duif.ring_kort;
    $('mn-lang').textContent = duif.ring_lang;
    const inp = $('duif-naam');
    inp.value = '';
    $('naam-overlay').classList.remove('verborgen');
    setTimeout(() => inp.focus(), 30);
    state.pendingNaam = { duif: duif };
  }

  /** Terug vanaf het naam-scherm: keuze niet vastleggen, terug naar het kiezen. */
  function terugVanNaam() {
    $('naam-overlay').classList.add('verborgen');
    $('duif-naam').classList.remove('leeg-fout');
    state.pendingNaam = null;
    // De duif is nog niet vastgelegd, dus hij blijft beschikbaar.
    if (state.methode === 'willekeurig') resetAnimatie();
  }

  async function bevestigNaam() {
    if (!state.pendingNaam) return;
    const naam = $('duif-naam').value.trim();
    if (!naam) { $('duif-naam').focus(); $('duif-naam').classList.add('leeg-fout'); return; }
    $('duif-naam').classList.remove('leeg-fout');
    const duif = state.pendingNaam.duif;
    const team = huidigTeam();

    const knop = $('naam-ok'); knop.disabled = true; const oud = knop.textContent; knop.textContent = 'Opslaan…';
    try {
      if (LIVE) await API.kiesDuif({ ring_lang: duif.ring_lang, ring_kort: duif.ring_kort, naam: naam, team: team });
      commitPick(duif, naam);
      $('naam-overlay').classList.add('verborgen');
      state.pendingNaam = null;
      if (state.methode === 'willekeurig') resetAnimatie();
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    } finally {
      knop.disabled = false; knop.textContent = oud;
    }
  }

  function commitPick(duif, naam) {
    state.available = state.available.filter(d => d.ring_lang !== duif.ring_lang || d.ring_kort !== duif.ring_kort);
    const team = huidigTeam();
    (state.takenByTeam[team] = state.takenByTeam[team] || [])
      .push({ ring_kort: duif.ring_kort, ring_lang: duif.ring_lang, naam: naam });
    rendarPicks();
    if (state.methode === 'zelf') rendarZelfGrid();
    // markeer het ei als "weg" uit de kom (optioneel: laat er eentje verdwijnen)
    const eersteEi = $('kom-eieren').querySelector('.kom-ei:not(.weg)');
    if (eersteEi) eersteEi.classList.add('weg');
  }

  /* ============ 3. Klaar ============ */
  function klaar() {
    toon('scherm-klaar');
    const teams = state.order;
    const totaal = teams.reduce((s, t) => s + (state.takenByTeam[t] || []).length, 0);
    $('klaar-samenvatting').textContent = totaal + (totaal === 1 ? ' duif' : ' duiven') +
      ' verdeeld over ' + teams.length + ' teams.';
    const box = $('klaar-overzicht');
    box.innerHTML = '';
    teams.forEach(t => {
      const picks = state.takenByTeam[t] || [];
      const div = document.createElement('div'); div.className = 'klaar-team';
      div.innerHTML = '<h3>' + escapeHtml(t) + ' <span class="count">(' + picks.length + ')</span></h3>';
      const ul = document.createElement('ul');
      picks.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = '<span class="pick-naam">' + escapeHtml(p.naam || '(naamloos)') + '</span>' +
          '<span class="pick-ring">' + p.ring_kort + '</span>';
        ul.append(li);
      });
      div.append(ul); box.append(div);
    });
  }

  function kopieerKeuze() {
    const regels = [];
    state.order.forEach(t => (state.takenByTeam[t] || []).forEach(p =>
      regels.push([p.naam, p.ring_lang, p.ring_kort, t].join('\t'))));
    navigator.clipboard.writeText(regels.join('\n'))
      .then(() => alert('Alle keuzes gekopieerd (naam, lang, kort, team) — plak in de Duivendatabase.'))
      .catch(e => alert('Kopiëren lukte niet: ' + e.message));
  }

  /* ============ Hulp ============ */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ============ Init ============ */
  async function init() {
    const banner = $('banner');
    try {
      const { model, live } = await API.loadModel();
      LIVE = live;
      state.perTeam = Number(cfg.DUIVEN_PER_TEAM) || 8;
      $('per-team').value = state.perTeam;

      // Beschikbare duiven + reeds gekozen (resume).
      if (live) {
        model.duiven.forEach(d => {
          if (d.teams && d.teams.length) {
            d.teams.forEach(t => (state.takenByTeam[t] = state.takenByTeam[t] || [])
              .push({ ring_kort: d.ring_kort, ring_lang: d.ring_lang, naam: d.naam }));
          } else {
            state.available.push({ ring_kort: d.ring_kort, ring_lang: d.ring_lang });
          }
        });
      } else {
        // Demo: alles is "beschikbaar" zodat je de hele draft kunt oefenen.
        model.duiven.forEach(d => state.available.push({ ring_kort: d.ring_kort, ring_lang: d.ring_lang }));
      }

      // Draft-volgorde = omgekeerde eindstand van vorig jaar.
      const klassement = Scoring.computeStandings(model).klassement; // beste -> slechtste
      let order = klassement.map(r => r.deelnemer).reverse();         // slechtste -> beste
      if (!order.length) order = [...model.roster];
      state.order = order;

      const lijst = $('opzet-volgorde');
      order.forEach(t => lijst.append(maakOpzetRij(t)));
      nummerOpzet();

      banner.className = 'banner' + (live ? ' live' : '');
      banner.innerHTML = live
        ? 'Live · elke keuze wordt direct in de Google Sheet vastgelegd.'
        : 'Demo-modus · <strong>oefen de hele draft</strong> met alle duiven; keuzes worden ' +
          'nog niet opgeslagen (gebruik straks de kopieerknop). Stel API_URL in <code>config.js</code> in om echt op te slaan.';

      // Events
      $('start-draft').addEventListener('click', startDraft);
      document.querySelectorAll('.methode').forEach(b =>
        b.addEventListener('click', () => kiesMethode(b.dataset.methode)));
      $('kies-knop').addEventListener('click', trekEi);
      $('team-klaar').addEventListener('click', () => { state.idx++; beginTeam(); });
      $('naam-ok').addEventListener('click', bevestigNaam);
      $('naam-terug').addEventListener('click', terugVanNaam);
      $('duif-naam').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); bevestigNaam(); } });
      $('kopieer-keuze').addEventListener('click', kopieerKeuze);
    } catch (err) {
      banner.className = 'banner';
      banner.textContent = 'Kon de gegevens niet laden: ' + err.message;
    }
  }

  function startDraft() {
    const order = [...$('opzet-volgorde').children].map(li => li.dataset.team);
    if (!order.length) { $('opzet-melding').className = 'melding fout'; $('opzet-melding').textContent = 'Geen teams.'; return; }
    if (!state.available.length && !Object.keys(state.takenByTeam).length) {
      $('opzet-melding').className = 'melding fout';
      $('opzet-melding').textContent = 'Er zijn nog geen duiven. Zet ze eerst klaar op de pagina Voorbereiden.';
      return;
    }
    state.order = order;
    state.perTeam = Math.max(1, Number($('per-team').value) || 8);
    state.idx = 0;
    toon('scherm-beurt');
    beginTeam();
  }

  init();
})();
