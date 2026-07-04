/* tussenstand.js — openbare tussenstand met 4 tabbladen:
   1) Duiven vandaag (top 25: plek, kort ringnummer, team)
   2) Dagscore (deelnemers, laatste vlucht)
   3) Algemeen klassement (pijltjes pas vanaf de 2e vlucht)
   4) Beste duiven van het seizoen */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  document.title = (cfg.SEIZOEN || 'Duivencompetitie') + ' — Tussenstand';

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
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
      if (heeftTeam) main.append(el('span', { class: 'v', html: '&nbsp; ' + duif.teams.join(' · ') }));
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
      const duif = model.byNaam[d.naam];
      const kort = duif ? duif.ring_kort : '';
      const main = el('td', { class: 'dag-main' }, el('span', { class: 'd-naam' }, d.naam));
      if (d.teams.length) main.append(el('span', { class: 'v', html: '&nbsp; ' + d.teams.join(' · ') }));
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

  /* ---------- Tabbladen ---------- */
  function buildTabs(stand, model) {
    const defs = [
      { label: 'Duiven vandaag', build: () => renderDuivenVandaag(stand, model) },
      { label: 'Dagscore', build: () => renderDagscore(stand) },
      { label: 'Klassement', build: () => renderKlassement(stand) },
      { label: 'Beste duiven', build: () => renderBesteDuiven(stand, model) }
    ];
    const bar = el('div', { class: 'subtabs' });
    const panels = el('div', {});
    const knoppen = [];
    const vlakken = [];
    defs.forEach((d, i) => {
      const knop = el('button', { class: 'subtab' + (i === 0 ? ' active' : ''), type: 'button' }, d.label);
      const vlak = el('div', { class: 'subtab-panel' + (i === 0 ? '' : ' verborgen') }, d.build());
      knop.addEventListener('click', () => {
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

  async function init() {
    const banner = document.getElementById('banner');
    const inhoud = document.getElementById('inhoud');
    try {
      const { model, live } = await API.loadModel();
      const stand = Scoring.computeStandings(model);

      banner.className = 'banner' + (live ? ' live' : '');
      banner.textContent = live
        ? 'Live · standen werken automatisch bij zodra iemand een uitslag invoert.'
        : 'Demo-modus · dit toont de gemigreerde data uit je Google Sheet. Stel API_URL in config.js in om live te gaan.';

      inhoud.innerHTML = '';
      if (!stand.aantalVluchten) {
        inhoud.append(el('div', { class: 'card' }, el('div', { class: 'leeg' }, 'Nog geen vluchten ingevoerd.')));
        return;
      }
      inhoud.append(buildTabs(stand, model));
    } catch (err) {
      banner.className = 'banner';
      inhoud.innerHTML = '';
      inhoud.append(el('div', { class: 'melding fout' }, 'Kon de tussenstand niet laden: ' + err.message));
    }
  }

  init();
})();
