import express from 'express'
import fetch from 'node-fetch'
import cors from 'cors'

const app = express()
app.use(cors())

let cachedRate = null
let lastUpdate = 0

app.get('/rate/usdt_uah', async (req, res) => {
  const now = Date.now()

  // кеш 10 секунд
  if (cachedRate && now - lastUpdate < 10_000) {
    return res.json(cachedRate)
  }

  try {
    const r = await fetch(
      'https://whitebit.com/api/v4/public/ticker?market=USDT_UAH'
    )
    const data = await r.json()

    const rate = Number(data.bid)

    cachedRate = {
      rate,
      source: 'whitebit',
      ts: now
    }
    lastUpdate = now

    res.json(cachedRate)
  } catch (e) {
    res.status(500).json({ error: 'rate unavailable' })
  }
})

app.get('/health', (_, res) => res.send('ok'))

app.listen(3000)
