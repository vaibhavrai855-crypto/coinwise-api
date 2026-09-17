# Coinwise Market & AI API

A tiny backend with two jobs:
1. Fetches live NIFTY 50, SENSEX, and 4 major NSE stocks from Yahoo Finance.
2. Proxies questions from the "Coinwise AI" tutor widget to Google's Gemini API (free tier) — so the tutor works on your real, deployed website, not just inside the claude.ai preview.

## Why this exists

The claude.ai artifact preview cannot make network requests to outside
sites, and its built-in AI feature (`window.claude`) only exists inside
that preview — it disappears the moment your site is hosted anywhere
else. This server fixes both: it fetches market data itself, and it
holds your own Gemini API key so your live site can call an AI model
directly, safely (the key never reaches the browser).

## Run it locally

```bash
npm install
npm start
```

Visit `http://localhost:4000/api/quotes` for market data.

Test the tutor (needs `GEMINI_API_KEY` set first — see below):
```bash
curl -X POST http://localhost:4000/api/chat \
  -H "content-type: application/json" \
  -d '{"message":"What is a mutual fund?"}'
```

## Get a free Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with any Google account.
2. Click **Create API key**. No credit card needed for the free tier.
3. Copy the key — you'll paste it into Render below.
4. Google's free tier has its own rate limits (requests per minute/day) —
   check the current numbers on that same page if the tutor ever stops
   answering; this project's own 20/hour-per-visitor limit (below) is
   usually well under Google's ceiling.

## Deploy it for free (Render.com)

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Under **Environment**, add:
   - `GEMINI_API_KEY` = your key from above
   - `ALLOWED_ORIGIN` = your frontend's URL once you've deployed it (use `*` while testing)
5. Deploy. Note your URL, e.g. `https://coinwise-api.onrender.com`.

(Railway, Fly.io, or a small VPS work the same way. Avoid pure serverless
functions with very short timeouts — both the Yahoo and Gemini round
trips can take a few seconds.)

## Wire it into Coinwise

1. Host the `coinwise-site` folder yourself — Vercel, Netlify, GitHub Pages,
   or any static host (it must NOT be the claude.ai artifact preview, for
   the network-restriction reason above).
2. Open `assets/config.js` in that folder and set `COINWISE_API_BASE` to
   your deployed backend's URL, e.g. `https://coinwise-api.onrender.com`.
3. Re-upload the site. Both the live ticker and the AI tutor now work for
   every visitor.

The tutor widget is smart about where it's running: inside the claude.ai
preview it uses the free built-in AI automatically; anywhere else, it
calls this backend instead. You don't need to change anything for that
— it detects it automatically.

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
- **Gemini's free tier has limits** (requests per minute and per day) —
  generous for a personal project, but check Google AI Studio's current
  numbers if you expect real traffic, and lower this project's own
  20/hour-per-visitor limit if you need to stay well under them.
- **This is market data and a chat tutor only** — nothing here places
  trades or touches money.


