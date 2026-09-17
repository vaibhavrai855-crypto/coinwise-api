# Coinwise Market API

A tiny backend that fetches live NIFTY 50, SENSEX, and 4 major NSE stocks
from Yahoo Finance and serves them as clean JSON — so your Coinwise
webpage can show real (slightly delayed) market data instead of a
simulation.

## Why this exists

The claude.ai artifact preview cannot make network requests to outside
sites — that's a deliberate security restriction, not a bug. So a real
live feed has to come from your own small server, which your own
separately-hosted frontend then calls. This folder is that server.

## Run it locally

```bash
npm install
npm start
```

Visit `http://localhost:4000/api/quotes` — you should see JSON like:

```json
{ "cached": false, "quotes": [
  { "symbol": "NIFTY 50", "full": "Index", "price": 24812.3, "changePercent": 0.42, ... }
]}
```

## Deploy it for free (Render.com)

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Once deployed, note your URL, e.g. `https://coinwise-api.onrender.com`.
5. Set the `ALLOWED_ORIGIN` environment variable to your frontend's exact
   URL once you've deployed that too.

(Railway, Fly.io, or a small VPS work the same way. Avoid pure serverless
functions with very short timeouts — the Yahoo round trip can take a
couple of seconds.)

## Wire it into Coinwise

1. Host `coinwise.html` yourself — Vercel, Netlify, GitHub Pages, or any
   static host (again: it must NOT be the claude.ai artifact preview, for
   the same network-restriction reason above).
2. Open `frontend-live-ticker.js` in this folder, set `API_URL` to your
   deployed backend's `/api/quotes` endpoint, and swap it in for the
   existing simulated `tickMarket()` function in `coinwise.html`.
3. Done — the ticker now shows real prices, polling every 15 seconds, and
   quietly falls back to the simulation if the backend is ever unreachable.

## Honest limitations

- **Yahoo Finance's endpoint is unofficial.** It's widely used and stable
  in practice, but Yahoo could change or rate-limit it without notice.
  For anything beyond a personal/learning project, look at a proper
  provider with an SLA: NSE doesn't offer a public API, but brokers like
  Zerodha (Kite Connect) or Upstox do, usually free for personal use once
  you hold an account with them.
- **Delay, not real-time.** Expect roughly 1–15 minutes of lag depending
  on Yahoo's own caching — fine for an educational dashboard, not for
  placing trades.
- **This is market data display only** — nothing here places trades or
  touches money.
