// Traduce in italiano titoli e anteprime delle notizie straniere (servizio gratuito di Google Traduttore, senza chiave).
// Tiene una memoria (trad.json) così ogni ora traduce solo le notizie nuove.
import { readFile, writeFile } from "node:fs/promises";
const OUT = new URL("./news.json", import.meta.url), MEM = new URL("./trad.json", import.meta.url);
const MAX = 450; // traduzioni nuove al massimo per giro

async function tr(text){
  const u = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=it&dt=t&q=" + encodeURIComponent(text);
  for (let i = 0; i < 3; i++){
    try {
      const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(12000) });
      if (r.status === 429){ await new Promise(s => setTimeout(s, 2000 * (i + 1))); continue; }
      if (!r.ok) return null;
      const j = await r.json();
      return { text: (j[0] || []).map(s => s[0] || "").join(""), lang: j[2] || "" };
    } catch { await new Promise(s => setTimeout(s, 800)); }
  }
  return null;
}

const data = JSON.parse(await readFile(OUT, "utf8"));
let mem = {}; try { mem = JSON.parse(await readFile(MEM, "utf8")); } catch {}
const todo = data.items.filter(x => !mem[x.u]).slice(0, MAX);
let n = 0, fail = 0;
const q = [...todo];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let x; (x = q.shift());){
    const s = (x.s || "").slice(0, 400);
    const r = await tr(s ? `${x.t}\n${s}` : x.t);
    if (!r){ fail++; continue; }
    if (r.lang === "it"){ mem[x.u] = { it: 1 }; continue; }
    const [ti, ...rest] = r.text.split("\n");
    mem[x.u] = { ti: ti.trim(), si: rest.join(" ").trim() }; n++;
  }
}));
const keep = new Set(data.items.map(x => x.u));
for (const k of Object.keys(mem)) if (!keep.has(k)) delete mem[k];
for (const x of data.items){ const m = mem[x.u]; if (m && m.ti){ x.ti = m.ti; if (m.si) x.si = m.si; } }
await writeFile(OUT, JSON.stringify(data)); await writeFile(MEM, JSON.stringify(mem));
console.log(`Traduzioni: ${n} nuove, ${fail} non riuscite, ${data.items.filter(x => x.ti).length}/${data.items.length} notizie in italiano tradotte.`);
