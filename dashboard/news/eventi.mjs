// Calendario globale: gli appuntamenti economici della settimana corrente e della prossima
// (dati di ForexFactory, gratis e senza chiave), con il titolo tradotto in italiano.
// Tiene anche gli eventi dei 10 giorni passati, così il calendario non si svuota il lunedì.
import { readFile, writeFile } from "node:fs/promises";
const OUT = new URL("./eventi.json", import.meta.url);
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", accept: "application/json" };
// valute che contano di più; per le altre solo gli eventi ad alto impatto
const MAJOR = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CNY"]);

async function week(which){
  for (let i = 0; i < 3; i++){
    try {
      const r = await fetch(`https://nfs.faireconomy.media/ff_calendar_${which}.json`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
      console.log(which, "HTTP", r.status); if (r.status === 404) return [];
    } catch (e){ console.log(which, e.message); }
    await new Promise(s => setTimeout(s, 3000 * (i + 1)));
  }
  return [];
}
async function tr(text){
  for (let i = 0; i < 4; i++){
    try {
      const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t&q=" + encodeURIComponent(text), { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
      if (r.ok){ const j = await r.json(); const t = (j[0] || []).map(s => s[0] || "").join(""); if (t) return t; }
      else console.log("traduzione HTTP", r.status);
    } catch {}
    await new Promise(s => setTimeout(s, 1500 * (i + 1)));
  }
  return null;
}

let prev = { items: [], tr: {} };
try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}
const raw = [...await week("thisweek"), ...await week("nextweek")];
const items = new Map();
for (const x of prev.items || []) if (Date.parse(x.d) > Date.now() - 10 * 864e5) items.set(x.id, x);
for (const x of raw){
  const imp = String(x.impact || "");
  if (!/High|Medium|Holiday/.test(imp)) continue;
  if (!MAJOR.has(x.country) && imp !== "High") continue;
  const d = new Date(x.date); if (isNaN(d)) continue;
  const id = `${x.country}|${x.title}|${d.toISOString().slice(0, 10)}`;
  items.set(id, { id, d: d.toISOString(), allDay: /all day|tentative/i.test(x.time || "") || imp === "Holiday", t: x.title, c: x.country, imp: imp === "High" ? 3 : imp === "Medium" ? 2 : 1,
    fc: x.forecast || "", pv: x.previous || "", ac: x.actual || (items.get(id) || {}).ac || "" });
}
// risultati trimestrali delle grandi aziende (calendario Nasdaq, gratis): date ufficiali, non indovinate dall'AI
const BIG = { NVDA: "Nvidia", AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet (Google)", GOOG: "Alphabet (Google)", AMZN: "Amazon", META: "Meta", TSLA: "Tesla", AVGO: "Broadcom",
  NFLX: "Netflix", AMD: "AMD", ORCL: "Oracle", CRM: "Salesforce", ADBE: "Adobe", INTC: "Intel", TSM: "TSMC", ASML: "ASML", PLTR: "Palantir", JPM: "JPMorgan", GS: "Goldman Sachs",
  BAC: "Bank of America", WMT: "Walmart", COST: "Costco", V: "Visa", MA: "Mastercard", LLY: "Eli Lilly", NVO: "Novo Nordisk", UNH: "UnitedHealth", XOM: "ExxonMobil", MU: "Micron",
  QCOM: "Qualcomm", ARM: "Arm", SNOW: "Snowflake", CSCO: "Cisco", IBM: "IBM", DIS: "Disney", NKE: "Nike", BRK: "Berkshire Hathaway", HD: "Home Depot", TGT: "Target", UBER: "Uber", SHOP: "Shopify" };
const capNum = s => +String(s || "").replace(/[^0-9.]/g, "") || 0;
// ora di New York -> ISO, tenendo conto dell'ora legale americana
function nyISO(day, hh, mm){
  for (const off of [4, 5]){ const d = new Date(`${day}T${String(hh + off).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
    const h = +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(d); if (h === hh) return d.toISOString(); }
  return new Date(`${day}T${String(hh + 5).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`).toISOString();
}
let earnN = 0;
for (let i = 0; i < 21; i++){
  const day = new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
  const wd = new Date(day + "T12:00:00Z").getUTCDay(); if (wd === 0 || wd === 6) continue;
  try {
    const r = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${day}`, { headers: { ...UA, origin: "https://www.nasdaq.com", referer: "https://www.nasdaq.com/" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok){ console.log("earnings", day, "HTTP", r.status); continue; }
    const rows = ((await r.json()).data || {}).rows || [];
    for (const x of [...items.values()]) if (x.earn && x.id.endsWith("|" + day)) items.delete(x.id); // giorno riletto: tolgo le date vecchie (spostate)
    for (const e of rows){
      const sym = String(e.symbol || "").toUpperCase(), name = BIG[sym];
      if (!name && capNum(e.marketCap) < 150e9) continue;
      const nm = name || String(e.name || sym).replace(/,? (Inc|Corp|Corporation|Ltd|Limited|plc|N\.V\.|Holdings?|Company|Co)\.?$/i, "");
      const tm = String(e.time || ""), pre = /pre-market/i.test(tm), after = /after-hours/i.test(tm);
      const id = `EARN|${sym}|${day}`;
      items.set(id, { id, earn: 1, sym, d: pre ? nyISO(day, 7, 0) : after ? nyISO(day, 16, 20) : day + "T12:00:00.000Z", allDay: !(pre || after), t: `${nm} earnings`, ti: `Risultati trimestrali ${nm}`,
        c: "USD", imp: (name || capNum(e.marketCap) >= 500e9) ? 3 : 2, fc: e.epsForecast ? `EPS ${e.epsForecast}` : "", pv: "", ac: "", when: pre ? "prima dell'apertura di Wall Street" : after ? "dopo la chiusura di Wall Street" : "" });
      earnN++;
    }
  } catch (err){ console.log("earnings", day, err.message); }
  await new Promise(s => setTimeout(s, 400));
}
console.log("risultati trimestrali", earnN);
// grandi quotazioni in borsa (IPO) dal calendario Nasdaq: debutto in borsa e, la sera prima, il prezzo
const usd = s => +String(s || "").replace(/[^0-9.]/g, "") || 0;
const mdY = s => { const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : ""; };
// nel calendario Nasdaq la data è il primo giorno di scambi; il prezzo si fissa la sera del giorno lavorativo prima
const prevBiz = day => { let d = new Date(day + "T12:00:00Z"); do d = new Date(+d - 864e5); while ([0, 6].includes(d.getUTCDay())); return d.toISOString().slice(0, 10); };
let ipoN = 0;
for (const mo of [0, 1]){
  const d0 = new Date(); d0.setUTCDate(1); d0.setUTCMonth(d0.getUTCMonth() + mo);
  const ym = d0.toISOString().slice(0, 7);
  try {
    const r = await fetch(`https://api.nasdaq.com/api/ipo/calendar?date=${ym}`, { headers: { ...UA, origin: "https://www.nasdaq.com", referer: "https://www.nasdaq.com/" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok){ console.log("ipo", ym, "HTTP", r.status); continue; }
    const D = (await r.json()).data || {};
    const up = (((D.upcoming || {}).upcomingTable || {}).rows || []).map(x => ({ ...x, day: mdY(x.expectedPriceDate), priced: false }));
    const pr = (((D.priced || {}).rows) || []).map(x => ({ ...x, day: mdY(x.pricedDate), priced: true }));
    for (const x of [...up, ...pr]){
      const val = usd(x.dollarValueOfSharesOffered) || usd(x.proposedSharePrice) * usd(x.sharesOffered);
      if (!x.day || val < 1e9) continue; // solo le quotazioni da almeno 1 miliardo di dollari
      const nm = String(x.companyName || "").replace(/,? (Inc|Corp|Corporation|PBC|Ltd|Limited|plc|Holdings?|Co)\.?$/gi, "").trim(), tk = x.proposedTickerSymbol || x.proposedSymbol || "";
      const mld = (val / 1e9).toFixed(val >= 1e10 ? 0 : 1);
      const deb = x.day, pday = prevBiz(x.day);
      if (Date.parse(deb) < Date.now() - 10 * 864e5) continue;
      const base = { c: "USD", imp: val >= 5e9 ? 3 : 2, fc: x.proposedSharePrice ? `prezzo ${x.proposedSharePrice} $` : "", pv: "", ac: "", ipo: 1, sym: tk };
      items.set(`IPO|${tk || nm}|P`, { ...base, id: `IPO|${tk || nm}|P`, d: nyISO(pday, 18, 0), allDay: true, t: `${nm} IPO pricing`, ti: `${nm}: fissato il prezzo della quotazione (IPO, ~${mld} mld $)`, when: "" });
      items.set(`IPO|${tk || nm}|D`, { ...base, id: `IPO|${tk || nm}|D`, d: nyISO(deb, 9, 30), allDay: false, t: `${nm} IPO debut`, ti: `${nm} debutta in borsa${tk ? " (" + tk + ")" : ""} · IPO da ~${mld} mld $`, imp: val >= 5e9 ? 3 : 2, when: "primi scambi dopo l'apertura di Wall Street" });
      ipoN++;
    }
  } catch (err){ console.log("ipo", ym, err.message); }
}
console.log("ipo grandi", ipoN);
const trm = prev.tr || {};
const todo = [...new Set([...items.values()].filter(x => !x.earn && !x.ipo).map(x => x.t))].filter(t => !trm[t]).slice(0, 150);
let ok = 0; for (const t of todo){ const it = await tr(t); if (it){ trm[t] = it; ok++; } await new Promise(s => setTimeout(s, 250)); }
for (const x of items.values()) if (!x.earn && !x.ipo) x.ti = trm[x.t] || "";
const list = [...items.values()].sort((a, b) => a.d.localeCompare(b.d));
if (!list.length && !(prev.items || []).length){ console.log("nessun evento: non scrivo il file"); process.exit(0); }
await writeFile(OUT, JSON.stringify({ updated: Date.now(), source: "ForexFactory", items: list, tr: trm }));
console.log("eventi", list.length, "traduzioni", ok + "/" + todo.length, "grezzi", raw.length);
