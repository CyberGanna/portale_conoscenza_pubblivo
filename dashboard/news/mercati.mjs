// Mercati: scarica i prezzi giornalieri (Yahoo Finance, gratis) e trova le variazioni più significative del giorno.
// "Significativa" = variazione di oggi divisa per la variazione tipica degli ultimi 3 mesi (z-score),
// così un +1% su EUR/CHF conta più di un +1% sul Bitcoin.
import { writeFileSync } from "node:fs";

const L = [
  // indici
  ["^GSPC", "S&P 500", "Indici"], ["^IXIC", "Nasdaq", "Indici"], ["^DJI", "Dow Jones", "Indici"], ["^RUT", "Russell 2000", "Indici"],
  ["^STOXX50E", "Euro Stoxx 50", "Indici"], ["FTSEMIB.MI", "FTSE MIB", "Indici"], ["^GDAXI", "DAX", "Indici"], ["^FCHI", "CAC 40", "Indici"],
  ["^FTSE", "FTSE 100", "Indici"], ["^SSMI", "SMI", "Indici"], ["^N225", "Nikkei 225", "Indici"], ["^HSI", "Hang Seng", "Indici"],
  ["000001.SS", "Shanghai", "Indici"], ["^VIX", "VIX (paura)", "Indici"],
  // valute
  ["EURUSD=X", "EUR/USD", "Valute"], ["EURCHF=X", "EUR/CHF", "Valute"], ["USDCHF=X", "USD/CHF", "Valute"], ["USDJPY=X", "USD/JPY", "Valute"],
  ["GBPUSD=X", "GBP/USD", "Valute"], ["DX-Y.NYB", "Indice dollaro", "Valute"], ["USDCNY=X", "USD/CNY", "Valute"],
  // futures (contratti che si scambiano quasi 24 ore su 24)
  ["ES=F", "Future S&P 500", "Futures"], ["NQ=F", "Future Nasdaq 100", "Futures"], ["YM=F", "Future Dow Jones", "Futures"], ["RTY=F", "Future Russell 2000", "Futures"],
  ["ZN=F", "Future Treasury 10 anni", "Futures"], ["6E=F", "Future Euro", "Futures"], ["ZC=F", "Future Mais", "Futures"], ["ZS=F", "Future Soia", "Futures"],
  // tassi
  ["^TNX", "Rendimento USA 10 anni", "Tassi"], ["^TYX", "Rendimento USA 30 anni", "Tassi"],
  // materie prime
  ["GC=F", "Oro", "Materie prime"], ["SI=F", "Argento", "Materie prime"], ["CL=F", "Petrolio WTI", "Materie prime"], ["BZ=F", "Petrolio Brent", "Materie prime"],
  ["NG=F", "Gas naturale", "Materie prime"], ["HG=F", "Rame", "Materie prime"], ["ZW=F", "Grano", "Materie prime"],
  // cripto
  ["BTC-USD", "Bitcoin", "Cripto"], ["ETH-USD", "Ethereum", "Cripto"], ["SOL-USD", "Solana", "Cripto"],
  // azioni
  ["AAPL", "Apple", "Azioni"], ["MSFT", "Microsoft", "Azioni"], ["NVDA", "Nvidia", "Azioni"], ["AMZN", "Amazon", "Azioni"], ["GOOGL", "Alphabet (Google)", "Azioni"],
  ["META", "Meta", "Azioni"], ["TSLA", "Tesla", "Azioni"], ["AVGO", "Broadcom", "Azioni"], ["JPM", "JPMorgan", "Azioni"], ["NFLX", "Netflix", "Azioni"],
  ["NESN.SW", "Nestlé", "Azioni"], ["NOVN.SW", "Novartis", "Azioni"], ["ROG.SW", "Roche", "Azioni"], ["UBSG.SW", "UBS", "Azioni"],
  ["ASML.AS", "ASML", "Azioni"], ["SAP.DE", "SAP", "Azioni"], ["MC.PA", "LVMH", "Azioni"], ["NOVO-B.CO", "Novo Nordisk", "Azioni"],
  ["ENI.MI", "Eni", "Azioni"], ["ISP.MI", "Intesa Sanpaolo", "Azioni"], ["UCG.MI", "UniCredit", "Azioni"], ["RACE.MI", "Ferrari", "Azioni"], ["STLAM.MI", "Stellantis", "Azioni"],
];

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", accept: "application/json" };
async function chart(sym, range = "1y", iv = "1d"){
  for (const host of ["query1", "query2"]){
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${iv}`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      const j = await r.json(), res = j.chart?.result?.[0]; if (!res) continue;
      return res;
    } catch {}
  }
  return null;
}

const out = [], STORIA = {};
for (let i = 0; i < L.length; i += 6){
  const part = await Promise.all(L.slice(i, i + 6).map(async ([s, n, cls]) => {
    const r = await chart(s); if (!r) return null;
    const ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || [];
    const pts = ts.map((t, k) => [t, cl[k]]).filter(p => p[1] != null);
    const m = r.meta || {};
    if (m.regularMarketPrice != null && pts.length){
      // l'ultima barra può essere la seduta in corso: usa il prezzo più recente
      const lastDay = new Date(pts.at(-1)[0] * 1000).toISOString().slice(0, 10), mDay = new Date((m.regularMarketTime || 0) * 1000).toISOString().slice(0, 10);
      if (lastDay === mDay) pts.at(-1)[1] = m.regularMarketPrice; else if (m.regularMarketTime > pts.at(-1)[0]) pts.push([m.regularMarketTime, m.regularMarketPrice]);
    }
    if (pts.length < 25) return null;
    // storia per la scheda dello strumento: 1 anno giorno per giorno + tutta la storia mese per mese
    const mo = await chart(s, "max", "1mo"), mts = mo?.timestamp || [], mcl = mo?.indicators?.quote?.[0]?.close || [];
    const r4 = v => +v.toPrecision(5);
    STORIA[s] = { d: pts.map(p => [Math.round(p[0] / 86400), r4(p[1])]), m: mts.map((t, k) => [Math.round(t / 86400), mcl[k]]).filter(p => p[1] != null).map(p => [p[0], r4(p[1])]),
      first: m.firstTradeDate || mts[0] || null, ex: m.fullExchangeName || m.exchangeName || "", tz: m.exchangeTimezoneName || "" };
    const px = pts.map(p => p[1]), ret = px.slice(1).map((v, k) => v / px[k] - 1);
    const today = ret.at(-1), hist = ret.slice(-91, -1);
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / (hist.length - 1)) || 1e-9;
    const wk = px.length > 6 ? px.at(-1) / px.at(-6) - 1 : null;
    return { s, n, cls, cur: m.currency || "", px: +px.at(-1).toPrecision(6), prev: +px.at(-2).toPrecision(6), pct: +(today * 100).toFixed(2),
      z: +(today / sd).toFixed(2), vol: +(sd * 100).toFixed(2), wk: wk == null ? null : +(wk * 100).toFixed(2),
      t: (m.regularMarketTime || pts.at(-1)[0]) * 1000, spark: px.slice(-30).map(v => +v.toPrecision(5)) };
  }));
  out.push(...part.filter(Boolean));
}
out.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
console.log(`Mercati: ${out.length}/${L.length} strumenti`, out.slice(0, 8).map(x => `${x.n} ${x.pct}% z${x.z}`).join(" | "));
if (!out.length) { console.log("Nessun dato: non scrivo il file"); process.exit(0); }
writeFileSync(new URL("./mercati.json", import.meta.url), JSON.stringify({ updated: Date.now(), items: out }));
writeFileSync(new URL("./storia.json", import.meta.url), JSON.stringify({ updated: Date.now(), s: STORIA }));
