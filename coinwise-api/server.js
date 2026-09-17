import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({ origin: ALLOWED_ORIGIN }));

// Instruments to track. Yahoo Finance ticker format:
// Indices use ^ prefix, NSE-listed stocks use the .NS suffix.
const INSTRUMENTS = [
  { symbol: '^NSEI',       name: 'NIFTY 50',  full: 'Index' },
  { symbol: '^BSESN',      name: 'SENSEX',    full: 'Index' },
  { symbol: 'RELIANCE.NS', name: 'RELIANCE',  full: 'Reliance Industries' },
  { symbol: 'TCS.NS',      name: 'TCS',       full: 'Tata Consultancy' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC BANK', full: 'HDFC Bank' },
  { symbol: 'INFY.NS',     name: 'INFY',      full: 'Infosys' }
];

// Yahoo's endpoint is unofficial and untyped, but works reliably without
// an API key as long as requests look like they come from a browser.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Simple in-memory cache so we don't hammer Yahoo on every page load —
// also protects you if this API gets popular.
let cache = { data: null, at: 0 };
const CACHE_MS = 15000;

async function fetchOne(ins) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ins.symbol)}?interval=5m&range=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Yahoo responded ${res.status} for ${ins.symbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for ${ins.symbol}`);

  const meta = result.meta;
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => typeof v === 'number');
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

  return {
    symbol: ins.name,
    full: ins.full,
    price,
    changePercent,
    currency: meta.currency,
    marketState: meta.marketState, // "REGULAR" | "CLOSED" | "PRE" | "POST"
    history: closes.slice(-20)
  };
}

app.get('/api/quotes', async (req, res) => {
  const now = Date.now();
  if (cache.data && now - cache.at < CACHE_MS) {
    return res.json({ cached: true, quotes: cache.data });
  }
  try {
    const quotes = await Promise.all(
      INSTRUMENTS.map(ins =>
        fetchOne(ins).catch(err => ({ symbol: ins.name, full: ins.full, error: err.message }))
      )
    );
    cache = { data: quotes, at: now };
    res.json({ cached: false, quotes });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch market data', detail: err.message });
  }
});

app.use(express.json());

// ---------------- AI TUTOR PROXY (Google Gemini — free tier) ----------------
// Keeps your Gemini API key on the server, never sent to the browser.
// Get a free key at https://aistudio.google.com/apikey and set it as
// GEMINI_API_KEY in your environment.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || 'gemini-2.0-flash';

const TUTOR_SYSTEM_PROMPT =
  "You are Coinwise AI, a friendly tutor inside a finance-education website for an Indian audience covering " +
  "personal finance, economics and stock market basics. Explain clearly in plain, encouraging language for a " +
  "beginner-to-intermediate learner. Use ₹ for money examples. Keep answers under about 120 words unless asked " +
  "for more depth. Never give specific personalised investment, tax or legal advice or recommend particular " +
  "stocks/funds to buy — teach the concept and suggest consulting a licensed advisor for personal decisions.";

// Very simple in-memory per-IP rate limit so a public page can't run up your
// Gemini usage. Resets whenever the server restarts — fine for a small project.
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60 * 60 * 1000; // per hour
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const record = hits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + RATE_WINDOW_MS; }
  record.count += 1;
  hits.set(ip, record);
  return record.count > RATE_LIMIT;
}

app.post('/api/chat', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI tutor is not configured on this server yet (missing GEMINI_API_KEY).' });
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many questions from this device in the last hour — try again later.' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Send a "message" string under 2000 characters.' });
  }
  const turns = Array.isArray(history) ? history.slice(-8) : [];
  const contents = [
    ...turns.map(t => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: TUTOR_SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 400 }
      })
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      return res.status(502).json({ error: 'AI tutor upstream error', detail });
    }
    const data = await geminiRes.json();
    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    res.json({ reply: reply || "I couldn't come up with an answer to that — try rephrasing." });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach the AI tutor', detail: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Coinwise market-data API is running. Try GET /api/quotes');
});

app.listen(PORT, () => console.log(`Coinwise API listening on port ${PORT}`));
