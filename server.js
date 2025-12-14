import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== НАСТРОЙКИ ===== */
const BASE_SPREAD = 0.008; // 0.8%
const BIG_AMOUNT_SPREAD = 0.005; // 0.5% для крупных сумм

const NETWORK_EXTRA = {
  TRC20: 0.0,
  BEP20: 0.001,
  ERC20: 0.003,
};

const BANK_EXTRA = {
  mono: 0.0,
  privat: 0.0,
  visa: 0.003,
};

/* ===== КЕШ ===== */
let cache = {
  prices: {},
  usdUah: null,
  ts: 0,
};

const CACHE_TTL = 10000; // 10 секунд

/* ===== WHITEBIT API ===== */
async function fetchWhitebitTicker(symbol) {
  const url = `https://whitebit.com/api/v4/public/ticker?market=${symbol}`;
  const r = await fetch(url);
  const j = await r.json();
  return Number(j.last);
}

async function updateCache() {
  const now = Date.now();
  if (now - cache.ts < CACHE_TTL) return;

  try {
    const [usdtUah, tonUsdt, btcUsdt, ethUsdt] = await Promise.all([
      fetchWhitebitTicker("USDT_UAH"),
      fetchWhitebitTicker("TON_USDT"),
      fetchWhitebitTicker("BTC_USDT"),
      fetchWhitebitTicker("ETH_USDT"),
    ]);

    cache = {
      prices: {
        TON: tonUsdt,
        BTC: btcUsdt,
        ETH: ethUsdt,
        USDT: 1,
      },
      usdUah: usdtUah,
      ts: now,
    };
  } catch (e) {
    console.error("WhiteBIT error", e);
  }
}

/* ===== РАСЧЁТ КУРСА ===== */
function calcRate({ from, to, net, bank, amount }) {
  let rate;

  // crypto → UAH
  if (to === "UAH") {
    rate = cache.prices[from] * cache.usdUah;
  }
  // UAH → crypto
  else if (from === "UAH") {
    rate = 1 / (cache.prices[to] * cache.usdUah);
  }
  // crypto → crypto
  else {
    rate = cache.prices[from] / cache.prices[to];
  }

  // спред
  const spread = amount >= 30000 ? BIG_AMOUNT_SPREAD : BASE_SPREAD;
  rate *= 1 + spread;

  // сеть
  if (NETWORK_EXTRA[net]) {
    rate *= 1 + NETWORK_EXTRA[net];
  }

  // банк
  if (BANK_EXTRA[bank]) {
    rate *= 1 + BANK_EXTRA[bank];
  }

  return rate;
}

/* ===== API ===== */
app.get("/rate", async (req, res) => {
  const {
    from = "USDT",
    to = "UAH",
    net = "TRC20",
    bank = "mono",
    amount = 0,
  } = req.query;

  await updateCache();

  if (!cache.usdUah) {
    return res.status(503).json({ error: "Rate unavailable" });
  }

  const rate = calcRate({
    from,
    to,
    net,
    bank,
    amount: Number(amount),
  });

  res.json({
    rate: Number(rate.toFixed(6)),
    source: "whitebit",
    ts: Date.now(),
  });
});

app.listen(PORT, () => {
  console.log("KeksSwap rate API running on", PORT);
});
