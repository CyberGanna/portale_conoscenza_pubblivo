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
const trm = prev.tr || {};
const todo = [...new Set([...items.values()].map(x => x.t))].filter(t => !trm[t]).slice(0, 150);
let ok = 0; for (const t of todo){ const it = await tr(t); if (it){ trm[t] = it; ok++; } await new Promise(s => setTimeout(s, 250)); }
for (const x of items.values()) x.ti = trm[x.t] || "";
const list = [...items.values()].sort((a, b) => a.d.localeCompare(b.d));
if (!list.length && !(prev.items || []).length){ console.log("nessun evento: non scrivo il file"); process.exit(0); }
await writeFile(OUT, JSON.stringify({ updated: Date.now(), source: "ForexFactory", items: list, tr: trm }));
console.log("eventi", list.length, "traduzioni", ok + "/" + todo.length, "grezzi", raw.length);
