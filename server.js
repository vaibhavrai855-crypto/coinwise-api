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

app.get('/', (req, res) => {
  res.send('Coinwise market-data API is running. Try GET /api/quotes');
});

app.listen(PORT, () => console.log(`Coinwise API listening on port ${PORT}`));
