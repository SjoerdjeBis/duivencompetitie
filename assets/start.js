/* start.js — startpagina: laat zien waar het seizoen staat en wat de volgende stap is. */
(function () {
  'use strict';

  const cfg = window.DUIVEN_CONFIG || {};
  document.getElementById('titel').textContent = cfg.SEIZOEN || 'Duivencompetitie';
  const box = document.getElementById('status');

  /** Bepaalt de fase van het seizoen: { kop, tekst, link, knop, stap }. */
  function fase(m) {
    const inst = m.instellingen || {};
    const jaar = inst.seizoen || ((cfg.SEIZOEN || '').match(/\d{4}/) || [])[0] || '';
    const teams = m.deelnemers.length;
    const duiven = m.duiven.length;
    const perTeam = Number(inst.duivenPerTeam) || 0;
    const gekozen = m.duiven.filter(d => d.teams.length).length;
    const S = jaar ? 'Seizoen ' + jaar : 'Seizoen';

    if (m.vluchten.length) {
      const st = Scoring.computeStandings(m);
      const top = st.klassement[0];
      return { stap: S + ' loopt',
        kop: st.aantalVluchten + (st.aantalVluchten === 1 ? ' etappe' : ' etappes') + ' gereden',
        tekst: top ? 'Aan kop: ' + top.deelnemer + ' met ' + top.totaal + ' punten.' : '',
        link: './invoer.html', knop: 'Uitslag invoeren' };
    }
    if (!duiven) {
      return { stap: S + ' · stap 3 van 6', kop: 'Duifnummers invullen',
        tekst: teams + ' teams staan klaar. Zet nu de ringnummers van de duiven klaar.',
        link: './voorbereiden.html', knop: 'Naar Voorbereiden' };
    }
    const vol = m.deelnemers.filter(t => m.duiven.filter(d => d.teams.indexOf(t) >= 0).length >= perTeam).length;
    if (!gekozen) {
      return { stap: S + ' · stap 6 van 6', kop: 'Klaar voor het keuzemoment',
        tekst: duiven + ' duiven en ' + teams + ' teams; elk team kiest er maximaal ' + (perTeam || '?') +
          '. Check vooraf op Voorbereiden of het aantal per team klopt.',
        link: './keuzemoment.html', knop: 'Naar het keuzemoment' };
    }
    if (perTeam && vol < teams && gekozen < duiven) {
      return { stap: S + ' · keuzemoment bezig', kop: vol + ' van ' + teams + ' teams compleet',
        tekst: gekozen + ' van de ' + duiven + ' duiven zijn gekozen.',
        link: './deelnemers.html', knop: 'Bekijk de teams' };
    }
    return { stap: S, kop: 'Wachten op de eerste vlucht',
      tekst: 'Alle teams hebben gekozen (' + gekozen + ' duiven). Na de eerste vlucht vul je hier de uitslag in.',
      link: './invoer.html', knop: 'Uitslag invoeren' };
  }

  function render(m) {
    const f = fase(m);
    box.innerHTML = '';
    const stap = document.createElement('div'); stap.className = 'status-stap'; stap.textContent = f.stap;
    const kop = document.createElement('div'); kop.className = 'status-kop'; kop.textContent = f.kop;
    const tekst = document.createElement('p'); tekst.className = 'sub'; tekst.textContent = f.tekst;
    const a = document.createElement('a'); a.className = 'knop-link'; a.href = f.link; a.textContent = f.knop + ' →';
    box.append(stap, kop, tekst, a);
    box.classList.remove('verborgen');
  }

  API.loadModelSnel(render).catch(function () { /* geen status: de tegels werken gewoon */ });
})();
