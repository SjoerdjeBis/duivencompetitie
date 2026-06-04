/* tussenstand.js — rendert de openbare tussenstand. */
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
    kids.flat().forEach(c => n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  };

  function deltaBadge(d) {
    if (d > 0) return el('span', { class: 'delta up' }, '▲ ' + d);
    if (d < 0) return el('span', { class: 'delta down' }, '▼ ' + (-d));
    return el('span', { class: 'delta flat' }, '–');
  }

  function renderKlassement(stand) {
    const ol = el('ol', { class: 'klassement' });
    stand.klassement.forEach(row => {
      const li = el('li', { class: row.rang <= 3 ? 'top' + row.rang : '' });
      li.append(el('span', { class: 'rang' }, String(row.rang)));
      const naamWrap = el('span', { class: 'naam' }, row.deelnemer);
      li.append(naamWrap);
      li.append(deltaBadge(row.rangVerschil));
      li.append(el('span', { class: 'score' }, String(row.totaal), el('span', { class: 'pt' }, ' pt')));
      ol.append(li);
    });
    return el('div', { class: 'card' },
      el('h2', {}, 'Algemeen klassement ', el('span', { class: 'count' }, '· ' + stand.aantalVluchten + ' vluchten')),
      ol);
  }

  function renderLijstjes(stand) {
    const grid = el('div', { class: 'tweekolom' });

    // Laatste vlucht
    const lv = el('ul', { class: 'lijst' });
    if (stand.laatsteVlucht && stand.laatsteVlucht.scores.length) {
      stand.laatsteVlucht.scores.slice(0, 12).forEach(s =>
        lv.append(el('li', {}, el('span', { class: 'naam' }, s.deelnemer), el('span', { class: 'p' }, s.punten + ' pt'))));
    } else {
      lv.append(el('li', { class: 'leeg' }, 'Nog geen uitslagen'));
    }
    grid.append(el('div', { class: 'card' },
      el('h2', {}, 'Laatste vlucht ', el('span', { class: 'count' },
        stand.laatsteVlucht ? '· nr ' + stand.laatsteVlucht.nummer : '')),
      lv));

    // Beste duiven
    const bd = el('ul', { class: 'lijst' });
    stand.besteDuiven.slice(0, 12).forEach(d =>
      bd.append(el('li', {},
        el('span', {}, el('span', { class: 'naam' }, d.naam),
          d.teams.length ? el('span', { class: 'v', html: '&nbsp; ' + d.teams.join(' · ') }) : ''),
        el('span', { class: 'p' }, d.totaal + ' pt'))));
    grid.append(el('div', { class: 'card' },
      el('h2', {}, 'Beste duiven van het seizoen'), bd));

    return grid;
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
      inhoud.append(renderKlassement(stand));
      inhoud.append(renderLijstjes(stand));
    } catch (err) {
      banner.className = 'banner';
      inhoud.innerHTML = '';
      inhoud.append(el('div', { class: 'melding fout' }, 'Kon de tussenstand niet laden: ' + err.message));
    }
  }

  init();
})();
