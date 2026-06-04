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

  /**
   * Stuurt een nieuwe vlucht-uitslag in.
   * @param {{vlucht:number, finishers:Array<{ring_kort:string, naam_override?:string}>}} payload
   */
  async function submitUitslag(payload) {
    if (!isLive()) throw new Error('Inzenden kan alleen in live-modus (stel API_URL in config.js in).');
    const res = await fetch(cfg().API_URL, {
      method: 'POST',
      // text/plain voorkomt een CORS-preflight die Apps Script niet kan beantwoorden.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({ ok: false, error: 'Onleesbaar antwoord van server' }));
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  global.API = { loadModel, submitUitslag, isLive };
})(typeof window !== 'undefined' ? window : globalThis);
