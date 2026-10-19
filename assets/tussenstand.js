/* tussenstand.js — openbare tussenstand met 4 tabbladen:
   1) Duiven vandaag (top 25: plek, kort ringnummer, team)
   2) Dagscore (deelnemers, laatste vlucht)
   3) Algemeen klassement (pijltjes pas vanaf de 2e vlucht)
   4) Beste duiven van het seizoen */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  document.title = 'Tussenstand — ' + (cfg.SEIZOEN || 'Duivencompetitie');

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach(c => n.append(c && c.nodeType ? c : document.createTextNode(c)));
    return n;
  };

  function deltaBadge(d) {
    if (d > 0) return el('span', { class: 'delta up' }, '▲ ' + d);
    if (d < 0) return el('span', { class: 'delta down' }, '▼ ' + (-d));
    return el('span', { class: 'delta flat' }, '–');
  }

  function ringChip(kort) { return el('span', { class: 'ring-chip' }, kort); }

  /* ---------- 1) Duiven vandaag (laatste vlucht, top 25) ---------- */
  function renderDuivenVandaag(stand, model) {
    const last = model.vluchten[model.vluchten.length - 1];
    const finishers = last.finishers.slice().sort((a, b) => a.positie - b.positie).slice(0, 25);

    const rijen = finishers.map(f => {
      const duif = f._duif || {};
      const heeftTeam = duif.teams && duif.teams.length;
      const naam = duif.naam || f.naam_override || '—';
      const main = el('td', { class: 'dag-main' }, el('span', { class: 'd-naam' }, naam));
      if (heeftTeam) main.append(el('span', { class: 'v' }, '\u00a0 ' + duif.teams.join(' · ')));
      const tr = el('tr', {},
        el('td', { class: 'dag-pos' }, String(f.positie)),
        el('td', { class: 'dag-ring' }, f.ring_kort ? ringChip(f.ring_kort) : '—'),
        main,
        el('td', { class: 'dag-pt' }, String(f._punten || 0), el('span', { class: 'pt' }, ' pt')));
      if (!heeftTeam) tr.classList.add('reserve');
      return tr;
    });

    const tabel = el('table', { class: 'dag-tabel' },
      el('thead', {}, el('tr', {},
        el('th', { class: 'dag-pos' }, '#'),
        el('th', { class: 'dag-ring' }, 'Ringnr'),
        el('th', { class: 'dag-main' }, 'Duif'),
        el('th', { class: 'dag-pt' }, 'Punten'))),
      el('tbody', {}, rijen));

    return el('div', { class: 'card' },
      el('h2', {}, 'Uitslag duiven vandaag ', el('span', { class: 'count' }, '· vlucht ' + last.nummer)),
      el('div', { class: 'tabel-scroll' }, tabel));
  }

  /* ---------- 2) Dagscore deelnemers (laatste vlucht) ---------- */
  function renderDagscore(stand) {
    const ul = el('ul', { class: 'lijst' });
    const scores = (stand.laatsteVlucht && stand.laatsteVlucht.scores) || [];
    if (scores.length) {
      scores.forEach((s, i) => ul.append(el('li', {},
        el('span', { class: 'naam' }, (i + 1) + '. ' + s.deelnemer),
        el('span', { class: 'p' }, s.punten + ' pt'))));
    } else {
      ul.append(el('li', { class: 'leeg' }, 'Nog geen uitslagen'));
    }
    return el('div', { class: 'card' },
      el('h2', {}, 'Dagscore deelnemers ', el('span', { class: 'count' },
        stand.laatsteVlucht ? '· vlucht ' + stand.laatsteVlucht.nummer : '')),
      ul);
  }

  /* ---------- 3) Algemeen klassement ---------- */
  function renderKlassement(stand) {
    const toonDelta = stand.aantalVluchten > 1; // 1e vlucht: geen stijg-/daalpijltjes
    const ol = el('ol', { class: 'klassement' + (toonDelta ? '' : ' geen-delta') });
    stand.klassement.forEach(row => {
      const li = el('li', { class: row.rang <= 3 ? 'top' + row.rang : '' });
      li.append(el('span', { class: 'rang' }, String(row.rang)));
      li.append(el('span', { class: 'naam' }, row.deelnemer));
      if (toonDelta) li.append(deltaBadge(row.rangVerschil));
      li.append(el('span', { class: 'score' }, String(row.totaal), el('span', { class: 'pt' }, ' pt')));
      ol.append(li);
    });
    return el('div', { class: 'card' },
      el('h2', {}, 'Algemeen klassement ', el('span', { class: 'count' }, '· ' + stand.aantalVluchten +
        (stand.aantalVluchten === 1 ? ' vlucht' : ' vluchten'))),
      ol);
  }

  /* ---------- 4) Beste duiven van het seizoen ---------- */
  function renderBesteDuiven(stand, model) {
    if (!stand.besteDuiven.length) {
      return el('div', { class: 'card' },
        el('h2', {}, 'Beste duiven van het seizoen'),
        el('div', { class: 'leeg' }, 'Nog geen scores'));
    }

    const rijen = stand.besteDuiven.map((d, i) => {
      const kort = d.ring_kort || '';
      const main = el('td', { class: 'dag-main' }, el('span', { class: 'd-naam' }, d.naam));
      if (d.teams.length) main.append(el('span', { class: 'v' }, '\u00a0 ' + d.teams.join(' · ')));
      return el('tr', {},
        el('td', { class: 'dag-pos' }, String(i + 1)),
        el('td', { class: 'dag-ring' }, kort ? ringChip(kort) : '—'),
        main,
        el('td', { class: 'dag-pt' }, String(d.totaal), el('span', { class: 'pt' }, ' pt')));
    });

    const tabel = el('table', { class: 'dag-tabel' },
      el('thead', {}, el('tr', {},
        el('th', { class: 'dag-pos' }, '#'),
        el('th', { class: 'dag-ring' }, 'Ringnr'),
        el('th', { class: 'dag-main' }, 'Duif'),
        el('th', { class: 'dag-pt' }, 'Punten'))),
      el('tbody', {}, rijen));

    return el('div', { class: 'card' },
      el('h2', {}, 'Beste duiven van het seizoen'),
      el('div', { class: 'tabel-scroll' }, tabel));
  }

  /* ---------- 5) Teams (overzicht per team, alleen-lezen) ---------- */
  function renderTeams(stand, model) {
    const pv = Scoring.duivenPerVlucht(model);
    const etappes = pv.vluchten;
    const duiven = pv.duiven;
    let teamVolgorde = stand.klassement.map(r => r.deelnemer);
    if (!teamVolgorde.length) teamVolgorde = [...model.roster];

    const wrap = el('div', {});
    teamVolgorde.forEach(team => {
      const eigen = duiven
        .filter(d => d.teams.indexOf(team) >= 0)
        .sort((a, b) => b.totaal - a.totaal || (a.naam || '').localeCompare(b.naam || '', 'nl'));
      const teamTot = eigen.reduce((s, d) => s + d.totaal, 0);

      const card = el('div', { class: 'card' },
        el('h2', {},
          el('span', {}, team),
          el('span', { class: 'count' }, '· ' + eigen.length + (eigen.length === 1 ? ' duif' : ' duiven')),
          el('span', { class: 'team-totaal' }, teamTot + ' pt')));

      if (!eigen.length) {
        card.append(el('div', { class: 'leeg' }, 'Nog geen duiven voor dit team.'));
        wrap.append(card);
        return;
      }

      const kopTr = el('tr', {},
        el('th', { class: 'k-naam' }, 'Duif'),
        el('th', { class: 'k-ring' }, 'Ringnummer'));
      etappes.forEach((nr, i) => {
        const th = el('th', { class: 'k-etappe' }, String(i + 1));
        th.title = 'Etappe ' + (i + 1) + ' (vlucht ' + nr + ')';
        kopTr.append(th);
      });
      kopTr.append(el('th', { class: 'k-totaal' }, 'Tot'));

      const tbody = el('tbody', {});
      eigen.forEach(d => {
        const tr = el('tr', {},
          el('td', { class: 'od-naam' + (d.naam ? '' : ' naamloos') }, d.naam || '(naamloos)'),
          el('td', { class: 'od-ring' }, d.ring_lang || ''));
        etappes.forEach(nr => {
          const pts = d.perVlucht[nr] || 0;
          tr.append(el('td', { class: 'od-etappe' + (pts ? '' : ' nul') }, pts ? String(pts) : ''));
        });
        tr.append(el('td', { class: 'od-totaal' }, String(d.totaal)));
        tbody.append(tr);
      });

      const tabel = el('table', { class: 'overzicht-tabel' }, el('thead', {}, kopTr), tbody);
      card.append(el('div', { class: 'tabel-scroll' }, tabel));
      wrap.append(card);
    });
    return wrap;
  }

  /* ---------- Tabbladen ---------- */
  let actieveTab = 0;   // blijft staan bij verversen
  function buildTabs(stand, model) {
    const defs = [
      { label: 'Duiven vandaag', build: () => renderDuivenVandaag(stand, model) },
      { label: 'Dagscore', build: () => renderDagscore(stand) },
      { label: 'Klassement', build: () => renderKlassement(stand) },
      { label: 'Beste duiven', build: () => renderBesteDuiven(stand, model) },
      { label: 'Teams', build: () => renderTeams(stand, model) }
    ];
    const bar = el('div', { class: 'subtabs' });
    const panels = el('div', {});
    const knoppen = [];
    const vlakken = [];
    defs.forEach((d, i) => {
      const knop = el('button', { class: 'subtab' + (i === actieveTab ? ' active' : ''), type: 'button' }, d.label);
      const vlak = el('div', { class: 'subtab-panel' + (i === actieveTab ? '' : ' verborgen') }, d.build());
      knop.addEventListener('click', () => {
        actieveTab = i;
        knoppen.forEach(b => b.classList.remove('active'));
        vlakken.forEach(v => v.classList.add('verborgen'));
        knop.classList.add('active');
        vlak.classList.remove('verborgen');
      });
      knoppen.push(knop); vlakken.push(vlak);
      bar.append(knop); panels.append(vlak);
    });
    return el('div', {}, bar, panels);
  }

  function tijd(ts) {
    return new Date(ts).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  /** Tekent de stand; wordt aangeroepen met bewaarde én met verse data. */
  function render(model, info) {
    const banner = document.getElementById('banner');
    const inhoud = document.getElementById('inhoud');
    const stand = Scoring.computeStandings(model);

    banner.className = 'banner' + (info.vers ? ' live' : '');
    banner.textContent = info.vers
      ? 'Live · bijgewerkt om ' + tijd(info.ts) + '. De stand ververst vanzelf.'
      : 'Stand van ' + tijd(info.ts) + ' · nieuwste stand ophalen…';

    document.title = 'Tussenstand — ' + (cfg.SEIZOEN || 'Duivencompetitie');
    const y = window.scrollY;   // niet naar boven springen bij verversen
    inhoud.innerHTML = '';
    if (!stand.aantalVluchten) {
      inhoud.append(el('div', { class: 'card' }, el('div', { class: 'leeg' }, 'Nog geen vluchten ingevoerd.')));
      return;
    }
    inhoud.append(buildTabs(stand, model));
    window.scrollTo(0, y);
  }

  async function laad() {
    try {
      await API.loadModelSnel(render);
    } catch (err) {
      const inhoud = document.getElementById('inhoud');
      if (inhoud.querySelector('.subtabs, .card')) {
        // We tonen al een (oudere) stand: alleen de banner aanpassen.
        document.getElementById('banner').textContent =
          'Kon de nieuwste stand niet ophalen; je ziet de laatst bekende stand.';
        return;
      }
      inhoud.innerHTML = '';
      inhoud.append(el('div', { class: 'melding fout' }, 'Kon de tussenstand niet laden: ' + err.message));
    }
  }

  // Elke 3 minuten (en bij terugkeren naar het tabblad) stil verversen.
  async function ververs() {
    if (document.hidden) return;
    try { const { model } = await API.loadModel(); render(model, { vers: true, ts: Date.now() }); } catch (e) {}
  }
  setInterval(ververs, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ververs(); });

  laad();
})();
