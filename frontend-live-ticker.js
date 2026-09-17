/*
  Drop-in replacement for the simulated `tickMarket()` block in coinwise.html.

  IMPORTANT: this only works once your Coinwise page is hosted on its OWN
  domain (Vercel/Netlify/Render/GitHub Pages/etc) — NOT inside the
  claude.ai artifact preview, which blocks outbound network requests by
  design. Host the HTML file yourself, point API_URL below at your
  deployed backend, and this will fetch real prices.

  Replace the existing `tickMarket()` function and its `setInterval` call
  with everything below.
*/

const API_URL = "https://YOUR-BACKEND-URL.onrender.com/api/quotes"; // <-- change this
const POLL_MS = 15000; // matches the backend's cache window

let usingLiveData = false;

async function tickMarket() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Bad response " + res.status);
    const { quotes } = await res.json();
    usingLiveData = true;

    quotes.forEach((q, idx) => {
      const card = tickerGrid.querySelector(`[data-idx="${idx}"]`);
      if (!card || q.error) return;
      card.querySelector('.ticker-price').textContent =
        q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 });
      const chgEl = card.querySelector('.ticker-chg');
      chgEl.textContent = (q.changePercent >= 0 ? '+' : '') + q.changePercent.toFixed(2) + '%';
      chgEl.className = 'ticker-chg ' + (q.changePercent >= 0 ? 'up' : 'down');
      if (q.history && q.history.length > 1) {
        const poly = card.querySelector('polyline');
        poly.setAttribute('points', sparkPoints(q.history));
        poly.setAttribute('stroke', q.changePercent >= 0 ? '#6FCB9F' : '#E38B72');
      }
    });

    document.querySelector('.ticker-note').textContent =
      "Live data via NSE/BSE tickers (may lag the real exchange by a few minutes).";
  } catch (err) {
    // Backend unreachable or still cold-starting on a free tier — fall back
    // to the simulated walk so the page never looks broken.
    if (usingLiveData) return; // don't thrash the note if it was live a moment ago
    simulateTick();
  }
}

// Keep your original simulated random-walk function, renamed, as the fallback:
function simulateTick() {
  instruments.forEach((ins, idx) => {
    const drift = (Math.random() - 0.48) * (ins.base * 0.0012);
    ins.price = Math.max(ins.base * 0.85, ins.price + drift);
    ins.history.push(ins.price);
    if (ins.history.length > 20) ins.history.shift();
    const changePct = ((ins.price - ins.base) / ins.base * 100);
    const card = tickerGrid.querySelector(`[data-idx="${idx}"]`);
    if (!card) return;
    card.querySelector('.ticker-price').textContent = ins.price.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const chgEl = card.querySelector('.ticker-chg');
    chgEl.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
    chgEl.className = 'ticker-chg ' + (changePct >= 0 ? 'up' : 'down');
    const poly = card.querySelector('polyline');
    poly.setAttribute('points', sparkPoints(ins.history));
    poly.setAttribute('stroke', changePct >= 0 ? '#6FCB9F' : '#E38B72');
  });
}

tickMarket();
setInterval(tickMarket, POLL_MS);
