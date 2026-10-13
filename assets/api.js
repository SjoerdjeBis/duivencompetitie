/*
 * api.js — laadt de ruwe data en stuurt nieuwe uitslagen in.
 *
 * Twee modi:
 *  - LIVE  : window.DUIVEN_CONFIG.API_URL is ingevuld -> data uit de Apps Script Web App.
 *  - DEMO  : geen API_URL -> ruwe CSV's uit /data (alleen-lezen, geen inzenden).
 *
 * Let op de Apps Script CORS-eigenaardigheid: GET werkt direct; POST gebeurt met
 * Content-Type text/plain (geen preflight), de body is JSON als tekst.
 */
(function (global) {
  'use strict';

  function cfg() { return global.DUIVEN_CONFIG || {}; }
  function isLive() { return !!(cfg().API_URL && cfg().API_URL.trim()); }

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' bij ' + url);
    return res.text();
  }

  /** Haalt de ruwe tabellen op en bouwt het Scoring-model. */
  async function loadModel() {
    if (isLive()) {
      const res = await fetch(cfg().API_URL + '?action=data', { cache: 'no-store' });
      if (!res.ok) throw new Error('API gaf HTTP ' + res.status);
      const raw = await res.json();
      if (raw.ok === false) throw new Error(raw.error || 'API gaf een fout');
      zetSeizoenTitel(raw.instellingen);
      return { model: Scoring.buildModel(raw), live: true };
    }
    // DEMO: laad de gebundelde CSV's.
    const base = './data/';
    const [duiven, resultaten, punten, deelnemers] = await Promise.all([
      fetchText(base + 'duiven.csv'),
      fetchText(base + 'resultaten.csv'),
      fetchText(base + 'puntentabel.csv'),
      fetchText(base + 'deelnemers.csv')
    ]);
    const raw = {
      duiven: Scoring.parseCSV(duiven),
      resultaten: Scoring.parseCSV(resultaten),
      punten: Scoring.parseCSV(punten),
      deelnemers: Scoring.parseCSV(deelnemers)
    };
    return { model: Scoring.buildModel(raw), live: false };
  }

  /** Het seizoen staat in de Sheet (Instellingen › seizoen); config.js is alleen de
   *  terugval. Zo verspringt de titel overal vanzelf naar het nieuwe jaar. */
  function zetSeizoenTitel(inst) {
    const jaar = inst && String(inst.seizoen || '').trim();
    if (!jaar) return;
    const titel = 'Duivencompetitie ' + jaar;
    cfg().SEIZOEN = titel;
    const h1 = document.getElementById('titel');
    if (h1) h1.textContent = titel;
  }

  /* ---------- Beheercode ----------
   * Schrijven naar de Sheet vraagt de beheercode (BEHEER_CODE in Apps Script).
   * Die wordt één keer per apparaat/browser gevraagd, gecontroleerd bij de server
   * en daarna in localStorage bewaard. Beheerpagina's (<body data-beheer>) tonen
   * rechtsboven een slotje: 🔒 code invullen / 🔓 ontgrendeld (klik = vergeten). */
  const CODE_KEY = 'duiven-beheercode';
  function getCode() { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } }
  function setCode(v) {
    try { v ? localStorage.setItem(CODE_KEY, v) : localStorage.removeItem(CODE_KEY); } catch (e) {}
    tekenSlot();
  }

  async function postOnce(payload, code) {
    const res = await fetch(cfg().API_URL, {
      method: 'POST',
      // text/plain voorkomt een CORS-preflight die Apps Script niet kan beantwoorden.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({}, payload, { code: code }))
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Onleesbaar antwoord van server' }));
    return { res, data };
  }

  /** Toont het code-venster. Resolvet met true zodra een juiste code is bewaard,
   *  of false als de gebruiker annuleert. */
  let codeVraag = null;
  function vraagCode(reden) {
    if (codeVraag) return codeVraag;
    codeVraag = new Promise(resolve => {
      const ov = document.createElement('div');
      ov.className = 'overlay code-overlay';
      ov.innerHTML =
        '<form class="modal code-modal">' +
          '<div class="modal-ei">🔒</div>' +
          '<h3>Beheercode</h3>' +
          '<p class="sub"></p>' +
          '<input type="password" autocomplete="current-password" placeholder="Beheercode" required>' +
          '<label class="code-onthoud"><input type="checkbox" checked> Onthoud op dit apparaat</label>' +
          '<div class="code-fout melding fout verborgen"></div>' +
          '<div class="knoppen midden">' +
            '<button type="button" class="ghost annuleer">Alleen kijken</button>' +
            '<button type="submit" class="primary">Ontgrendel</button>' +
          '</div>' +
        '</form>';
      ov.querySelector('.sub').textContent = reden ||
        'Om iets op te slaan is de beheercode nodig. Je vult hem op dit apparaat maar één keer in.';
      const form = ov.querySelector('form');
      const inp = form.querySelector('input[type=password]');
      const fout = form.querySelector('.code-fout');
      const knop = form.querySelector('button[type=submit]');
      const klaar = ok => { ov.remove(); codeVraag = null; resolve(ok); };
      form.querySelector('.annuleer').addEventListener('click', () => klaar(false));
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const code = inp.value.trim();
        if (!code) return;
        knop.disabled = true; knop.textContent = 'Controleren…';
        fout.classList.add('verborgen');
        try {
          const { data } = await postOnce({ action: 'checkCode' }, code);
          if (data.ok) {
            const onthoud = form.querySelector('.code-onthoud input').checked;
            if (onthoud) setCode(code); else { sessieCode = code; tekenSlot(); }
            return klaar(true);
          }
          fout.textContent = data.error || 'Code niet geaccepteerd.';
        } catch (err) {
          fout.textContent = 'Geen verbinding met de server: ' + err.message;
        }
        fout.classList.remove('verborgen');
        knop.disabled = false; knop.textContent = 'Ontgrendel';
        inp.select();
      });
      document.body.append(ov);
      inp.focus();
    });
    return codeVraag;
  }
  let sessieCode = '';   // als "onthoud" uit staat: alleen voor deze pagina
  function actieveCode() { return getCode() || sessieCode; }

  /** Stuurt een JSON-payload via POST naar de Apps Script Web App.
   *  Vraagt zo nodig (opnieuw) om de beheercode. */
  async function postJSON(payload) {
    if (!isLive()) throw new Error('Opslaan kan alleen in live-modus (stel API_URL in config.js in).');
    const openbaar = payload.action === 'kiesDuif' && payload.exclusief === true;
    if (!openbaar && !actieveCode() && !(await vraagCode())) {
      throw new Error('Niet opgeslagen: geen beheercode ingevuld.');
    }
    let { res, data } = await postOnce(payload, actieveCode());
    if (data.auth && !data.nietIngesteld) {
      setCode(''); sessieCode = '';
      if (await vraagCode('De bewaarde code klopt niet (meer). Vul de beheercode opnieuw in.')) {
        ({ res, data } = await postOnce(payload, actieveCode()));
      }
    }
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || ('HTTP ' + res.status));
      err.data = data;
      throw err;
    }
    return data;
  }

  /** Slotje in de kop van beheerpagina's. */
  function tekenSlot() {
    const body = document.body;
    if (!body || !('beheer' in body.dataset) || !isLive()) return;
    if (new URLSearchParams(location.search).has('team')) return; // teampagina keuzemoment
    let knop = document.getElementById('slot-knop');
    if (!knop) {
      const header = document.querySelector('header.app');
      if (!header) return;
      knop = document.createElement('button');
      knop.type = 'button';
      knop.id = 'slot-knop';
      knop.className = 'slot-knop';
      knop.addEventListener('click', () => {
        if (actieveCode()) {
          if (confirm('Beheercode vergeten op dit apparaat?\n\nJe kunt dan pas weer opslaan na het opnieuw invullen van de code.')) {
            sessieCode = ''; setCode('');
          }
        } else {
          vraagCode();
        }
      });
      const nav = header.querySelector('nav.tabs');
      header.insertBefore(knop, nav);
    }
    const open = !!actieveCode();
    knop.classList.toggle('open', open);
    knop.textContent = open ? '🔓 Ontgrendeld' : '🔒 Beheercode invullen';
    knop.title = open ? 'Opslaan staat aan op dit apparaat. Klik om de code te vergeten.'
                      : 'Vul de beheercode in om te kunnen opslaan';
  }

  // Bij het openen van een beheerpagina zonder bewaarde code: meteen vragen
  // (één keer per browsersessie; daarna via het slotje of bij de eerste opslag).
  function initSlot() {
    tekenSlot();
    const body = document.body;
    if (!body || !('beheer' in body.dataset) || !isLive() || actieveCode()) return;
    if (new URLSearchParams(location.search).has('team')) return;
    try {
      if (sessionStorage.getItem('duiven-code-gevraagd')) return;
      sessionStorage.setItem('duiven-code-gevraagd', '1');
    } catch (e) {}
    vraagCode();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSlot);
    else initSlot();
  }

  /**
   * Stuurt een nieuwe vlucht-uitslag in.
   * @param {{vlucht:number, finishers:Array<{ring_kort:string, naam_override?:string}>}} payload
   */
  function submitUitslag(payload) {
    return postJSON(Object.assign({ action: 'uitslag' }, payload));
  }

  /**
   * Slaat de seizoensvoorbereiding op: vervangt de deelnemers- en duivenlijst.
   * @param {{deelnemers:string[], duiven:Array<{ring_lang:string, ring_kort:string}>, wisUitslagen?:boolean}} payload
   */
  function saveSeizoen(payload) {
    return postJSON(Object.assign({ action: 'setupSeizoen' }, payload));
  }

  /**
   * Legt een keuze van het keuzemoment vast: zet naam + team op een duif.
   * @param {{ring_kort?:string, ring_lang?:string, naam:string, team:string}} payload
   */
  function kiesDuif(payload) {
    return postJSON(Object.assign({ action: 'kiesDuif' }, payload));
  }

  /** Hernoemt één duif (op ring_lang). @param {{ring_lang:string, naam:string}} payload */
  function hernoemDuif(payload) {
    return postJSON(Object.assign({ action: 'hernoemDuif' }, payload));
  }

  /** Haalt één duif uit één team weg (op ring_lang). @param {{ring_lang:string, team:string}} payload */
  function verwijderUitTeam(payload) {
    return postJSON(Object.assign({ action: 'verwijderUitTeam' }, payload));
  }

  /** Maakt alle duiven teamloos (en wist hun naam): klaar voor een nieuw keuzemoment. */
  function resetDuiven() {
    return postJSON({ action: 'resetDuiven' });
  }

  /** Slaat beheer-instellingen op (bv. { duivenPerTeam: 8 }). */
  function setInstellingen(payload) {
    return postJSON(Object.assign({ action: 'setInstellingen' }, payload));
  }

  /** Stap 1: kopie van de hele Sheet als archief (of met {url} een eigen kopie vastleggen). */
  function archiveerSeizoen(payload) {
    return postJSON(Object.assign({ action: 'archiveerSeizoen' }, payload));
  }

  /** Stap 2: uitslagen + duiven wissen, teamnamen bewaren, seizoen ophogen. */
  function nieuwSeizoen(payload) {
    return postJSON(Object.assign({ action: 'nieuwSeizoen' }, payload));
  }

  /** Stap 3: duivenlijst samenvoegen (bestaande duiven houden naam + team). */
  function setDuiven(payload) {
    return postJSON(Object.assign({ action: 'setDuiven' }, payload));
  }

  /** Stap 4: teamnamen vervangen; hernoemingen gaan mee naar de duiven. */
  function setDeelnemers(payload) {
    return postJSON(Object.assign({ action: 'setDeelnemers' }, payload));
  }

  global.API = {
    loadModel, submitUitslag, saveSeizoen, kiesDuif,
    hernoemDuif, verwijderUitTeam, resetDuiven, setInstellingen,
    archiveerSeizoen, nieuwSeizoen, setDuiven, setDeelnemers,
    vraagCode, isLive
  };
})(typeof window !== 'undefined' ? window : globalThis);
