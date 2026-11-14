// Aggiornatore notizie della Mia Dashboard.
// Gira ogni ora su GitHub Actions (gratis): legge i feed RSS delle testate,
// raggruppa gli stessi fatti, li classifica per categoria e paese e scrive news.json.
// Nessuna dipendenza: solo Node 20+.
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("./news.json", import.meta.url));
const RAW = fileURLToPath(new URL("./raw.json", import.meta.url));
const DAYS = 3;          // memoria: oggi, ieri, l'altro ieri. Il resto viene cancellato
const PER_DAY = 350;     // notizie tenute per ogni giorno
const TZ = "Europe/Zurich";
const dayOf = ts => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(ts);

const gn = (q, lang = "en") => lang === "it"
  ? `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=it&gl=IT&ceid=IT:it`
  : `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:1d")}&hl=en-US&gl=US&ceid=US:en`;
const gtop = (hl, gl, ceid) => `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;

// cc: paesi sempre assegnati · home: paese assegnato solo se non se ne riconosce un altro · cat: categoria se il testo non basta
export const FEEDS = [
  // Italia
  { n: "ANSA", u: "https://www.ansa.it/sito/ansait_rss.xml", home: "it" },
  { n: "ANSA", u: "https://www.ansa.it/sito/notizie/politica/politica_rss.xml", home: "it", cat: "politica" },
  { n: "ANSA", u: "https://www.ansa.it/sito/notizie/economia/economia_rss.xml", home: "it", cat: "economia" },
  { n: "ANSA", u: "https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml", cat: "esteri" },
  { n: "ANSA", u: "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml", cat: "tecnologia" },
  { n: "Il Post", u: "https://www.ilpost.it/feed/", home: "it" },
  { n: "Il Sole 24 Ore", u: "https://www.ilsole24ore.com/rss/italia.xml", home: "it" },
  { n: "Il Sole 24 Ore", u: "https://www.ilsole24ore.com/rss/mondo.xml", cat: "esteri" },
  { n: "Il Sole 24 Ore", u: "https://www.ilsole24ore.com/rss/finanza.xml", cat: "economia" },
  { n: "Il Sole 24 Ore", u: "https://www.ilsole24ore.com/rss/economia.xml", home: "it", cat: "economia" },
  { n: "Il Sole 24 Ore", u: "https://www.ilsole24ore.com/rss/tecnologia.xml", cat: "tecnologia" },
  { n: "la Repubblica", u: "https://www.repubblica.it/rss/homepage/rss2.0.xml", home: "it" },
  { n: "Corriere della Sera", u: "https://xml2.corriereobjects.it/rss/homepage.xml", home: "it" },
  { n: "Google News", u: gtop("it", "IT", "IT:it"), home: "it" },
  // Svizzera
  { n: "Google News", u: gtop("it", "CH", "CH:it"), home: "ch" },
  { n: "Google News", u: gn("Svizzera", "it"), cc: ["ch"] },
  { n: "Google News", u: gn("Switzerland"), cc: ["ch"] },
  // Mondo
  { n: "BBC", u: "https://feeds.bbci.co.uk/news/world/rss.xml", cat: "esteri" },
  { n: "BBC", u: "https://feeds.bbci.co.uk/news/business/rss.xml", cat: "economia" },
  { n: "BBC", u: "https://feeds.bbci.co.uk/news/technology/rss.xml", cat: "tecnologia" },
  { n: "BBC", u: "https://feeds.bbci.co.uk/news/uk/rss.xml", home: "uk" },
  { n: "The Guardian", u: "https://www.theguardian.com/world/rss", cat: "esteri" },
  { n: "New York Times", u: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", cat: "esteri" },
  { n: "New York Times", u: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", home: "us", cat: "politica" },
  { n: "Al Jazeera", u: "https://www.aljazeera.com/xml/rss/all.xml", cat: "esteri" },
  { n: "DW", u: "https://rss.dw.com/rdf/rss-en-all", cat: "esteri" },
  { n: "France 24", u: "https://www.france24.com/en/rss", cat: "esteri" },
  { n: "Euronews", u: "https://www.euronews.com/rss?format=mrss" },
  { n: "Politico Europe", u: "https://www.politico.eu/feed/", cat: "politica" },
  { n: "Kyiv Independent", u: "https://kyivindependent.com/feed/", cc: ["ua"] },
  { n: "CNBC", u: "https://www.cnbc.com/id/100003114/device/rss/rss.html", home: "us", cat: "economia" },
  { n: "Google News", u: gtop("en-US", "US", "US:en"), home: "us" },
  { n: "Google News", u: gtop("en-GB", "GB", "GB:en"), home: "uk" },
  { n: "Google News", u: gn("site:reuters.com") },
  { n: "Google News", u: gn("site:apnews.com") },
  { n: "Google News", u: gn("Germany OR German"), cc: ["de"] },
  { n: "Google News", u: gn("Spain OR Spanish"), cc: ["es"] },
  { n: "Google News", u: gn("France OR French"), cc: ["fr"] },
  { n: "Google News", u: gn("Russia OR Kremlin"), cc: ["ru"] },
  { n: "Google News", u: gn("Ukraine OR Kyiv"), cc: ["ua"] },
  { n: "Google News", u: gn("European Union OR Brussels OR EU Commission"), cc: ["eu"] },
  { n: "Google News", u: gn("China OR Beijing"), cc: ["cn"] },
  { n: "Google News", u: gn("Israel OR Gaza"), cc: ["il"] },
  { n: "Google News", u: gn("India"), cc: ["in"] },
  { n: "Google News", u: gn("Japan"), cc: ["jp"] },
  { n: "Google News", u: gn("Brazil"), cc: ["br"] },
  { n: "Google News", u: gn("Turkey OR Erdogan"), cc: ["tr"] },
  { n: "Google News", u: gn("stock market OR markets OR Federal Reserve OR ECB"), cat: "economia" },
  // Tecnologia e AI
  { n: "The Verge", u: "https://www.theverge.com/rss/index.xml", cat: "tecnologia" },
  { n: "Ars Technica", u: "https://feeds.arstechnica.com/arstechnica/index", cat: "tecnologia" },
  { n: "TechCrunch", u: "https://techcrunch.com/category/artificial-intelligence/feed/", cat: "ai" },
  { n: "MIT Technology Review", u: "https://www.technologyreview.com/feed/", cat: "tecnologia" },
  { n: "Google News", u: gn("artificial intelligence OR OpenAI OR Anthropic OR Gemini OR LLM"), cat: "ai" },
  { n: "Google News", u: gn("intelligenza artificiale", "it"), cat: "ai" },
  // LLM e novità AI: nuovi modelli, nuove funzioni, skill, strumenti e siti
  { n: "OpenAI", u: "https://openai.com/news/rss.xml", cat: "llm" },
  { n: "Google", u: "https://blog.google/technology/ai/rss/", cat: "llm" },
  { n: "Google DeepMind", u: "https://deepmind.google/blog/rss.xml", cat: "llm" },
  { n: "Hugging Face", u: "https://huggingface.co/blog/feed.xml", cat: "llm" },
  { n: "Simon Willison", u: "https://simonwillison.net/atom/everything/", cat: "llm" },
  { n: "The Verge", u: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", cat: "llm" },
  { n: "TestingCatalog", u: "https://www.testingcatalog.com/rss/", cat: "llm" },
  { n: "VentureBeat", u: "https://venturebeat.com/category/ai/feed/", cat: "llm" },
  { n: "Product Hunt", u: "https://www.producthunt.com/feed?category=artificial-intelligence", cat: "llm" },
  { n: "Google News", u: gn("Anthropic OR Claude AI OR site:anthropic.com"), cat: "llm" },
  { n: "Google News", u: gn("OpenAI OR ChatGPT new feature OR launches"), cat: "llm" },
  { n: "Google News", u: gn("Google Gemini OR DeepMind new model OR launches"), cat: "llm" },
  { n: "Google News", u: gn("new AI model OR LLM release OR open-source model OR AI agent launch"), cat: "llm" },
  { n: "Google News", u: gn("nuovo modello intelligenza artificiale OR ChatGPT OR Claude OR Gemini", "it"), cat: "llm" },
  // Attacchi hacker
  { n: "BleepingComputer", u: "https://www.bleepingcomputer.com/feed/", cat: "hacker" },
  { n: "The Hacker News", u: "https://feeds.feedburner.com/TheHackersNews", cat: "hacker" },
  { n: "The Record", u: "https://therecord.media/feed", cat: "hacker" },
  { n: "Krebs on Security", u: "https://krebsonsecurity.com/feed/", cat: "hacker" },
  { n: "Google News", u: gn("cyberattack OR ransomware OR data breach OR hackers"), cat: "hacker" },
  { n: "Google News", u: gn("attacco hacker OR ransomware OR cyber", "it"), cat: "hacker" },
  // Clima
  { n: "Carbon Brief", u: "https://www.carbonbrief.org/feed/", cat: "clima" },
  { n: "Google News", u: gn("COP31 OR climate change OR climate summit"), cat: "clima" },
  { n: "Google News", u: gn("COP31 OR clima OR cambiamento climatico", "it"), cat: "clima" },
];

/* ---------- classificazione ---------- */
// parole con una maiuscola (sigle e nomi: AI, US, UN, Meta, Fed...) vanno confrontate rispettando le maiuscole,
// altrimenti "ai", "us", "un", "meta" delle frasi normali farebbero scattare la categoria sbagliata
function R(src){
  const body = src.replace(/^\\b\(/, "").replace(/\)\\b$/, "");
  const alts = []; let depth = 0, cur = "";
  for (let i = 0; i < body.length; i++){
    const ch = body[i];
    if (ch === "\\"){ cur += ch + body[++i]; continue; }
    if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth--;
    if (ch === "|" && !depth){ alts.push(cur); cur = ""; } else cur += ch;
  }
  alts.push(cur);
  const upper = a => /[A-Z]/.test(a.replace(/\\[a-zA-Z]/g, ""));
  const mk = (list, fl) => list.length ? new RegExp(String.raw`(?<![\p{L}\p{N}])(${list.join("|")})(?![\p{L}\p{N}])`, fl) : null;
  const cs = mk(alts.filter(upper), "u"), ci = mk(alts.filter(a => !upper(a)), "iu");
  return { test: s => !!(cs && cs.test(s) || ci && ci.test(s)) };
}
export const CAT_RX = {
  hacker: R(String.raw`\b(hacker|hackers|hackerat\w*|hack(ed|ing)?|cyber\w*|ransomware|malware|phishing|data breach|breach|violazione dei dati|furto di dati|leak|ddos|zero-day|0-day|exploit|vulnerabilit\w+|backdoor|spyware|botnet|infostealer|CVE-\d+|patch tuesday|attacco informatico|attacchi informatici)\b`),
  ai: R(String.raw`\b(AI|IA|A\.I\.|artificial intelligence|intelligenza artificiale|machine learning|deep learning|LLM|chatbot|ChatGPT|OpenAI|Anthropic|Claude|Gemini|DeepMind|Copilot|Mistral|Llama|Nvidia|GPU|neural|generative|generativa|Sam Altman|AGI)\b`),
  llm: R(String.raw`\b(LLM|LLMs|large language model\w*|modell\w linguistic\w*|language model\w*|GPT-?\d[\w.-]*|ChatGPT|OpenAI|Anthropic|Claude|Opus|Sonnet|Haiku|Fable|Gemini|Gemma|DeepMind|Llama|Mistral|DeepSeek|Qwen|Kimi|Grok|xAI|Perplexity|Copilot|Cursor|Hugging Face|Midjourney|Sora|Veo|Codex|AI agent\w*|agentic|agent\w* AI|MCP|Model Context Protocol|chatbot\w*|open-weight|open-source model\w*|AI model\w*|modell\w di intelligenza artificiale|modell\w AI|reasoning model\w*)\b`),
  clima: R(String.raw`\b(COP ?31|COP ?30|COP ?29|climate|clima\w*|climatic\w*|global warming|riscaldamento globale|emission\w*|emissioni|carbon|CO2|net zero|renewable\w*|rinnovabil\w+|solar|solare|wind power|eolic\w+|heatwave|ondata di calore|drought|siccit\w|flood\w*|alluvion\w+|wildfire\w*|incendi\w*|glacier\w*|ghiacciai\w*|fossil fuel\w*|combustibili fossili|UNFCCC|Paris Agreement|Accordo di Parigi)\b`),
  economia: R(String.raw`\b(econom\w*|financ\w*|finanz\w*|market\w*|mercat\w+|borsa|borse|stock\w*|shares|azion\w+|Wall Street|Nasdaq|Dow Jones|S&P|FTSE|Ftse Mib|Dax|bond\w*|BTP|spread|inflation|inflazione|interest rate\w*|tass\w di interesse|tassi|Fed|Federal Reserve|BCE|ECB|central bank|banca centrale|Bank of England|GDP|PIL|recession\w*|recessione|tariff\w*|dazi\w*|trade war|earnings|trimestral\w+|utili|bilancio|IPO|merger|acquisition|acquisizione|fusione|bitcoin|crypto\w*|criptovalut\w+|oil price\w*|petrolio|gas price\w*|euro|dollar\w*|dollaro|yen|budget|manovra|tasse|tax\w*|debt|debito|jobs report|disoccupazione|unemployment|salari|wages)\b`),
  tecnologia: R(String.raw`\b(tech\w*|tecnologi\w+|software|hardware|smartphone\w*|iPhone|Android|Apple|Google|Microsoft|Meta|Amazon|Samsung|Tesla|SpaceX|chip\w*|semiconductor\w*|semicondutt\w+|app|apps|startup\w*|internet|5G|quantum|quantistic\w+|robot\w*|satellit\w+|digital\w*|digitale|cloud|data center|streaming|social network|TikTok|Instagram|X\.com|Elon Musk|gadget\w*|videogam\w+|gaming|console)\b`),
  politica: R(String.raw`\b(politic\w*|government|governo|minister\w*|ministr\w+|premier|prime minister|president\w*|presidente|parliament\w*|parlament\w+|senate|senato|congress|camera dei deputati|election\w*|elezion\w+|elettoral\w+|vote|voto|referendum|party|partito|Meloni|Schlein|Salvini|Tajani|Conte|Mattarella|Trump|Vance|Democrat\w*|Republican\w*|opposition|opposizione|coalition|coalizione|law|legge|decreto|bill|riforma|reform|White House|Casa Bianca|Palazzo Chigi|Quirinale|Downing Street|Bundestag|Merz|Starmer|Macron|S[aá]nchez|Consiglio federale|Bundesrat)\b`),
  esteri: R(String.raw`\b(war|guerra|ceasefire|cessate il fuoco|tregua|military|militar\w+|army|esercito|troops|truppe|missile\w*|drone\w*|strike\w*|raid|bomb\w*|invasion|invasione|NATO|Nato|ONU|UN|United Nations|Nazioni Unite|sanction\w*|sanzion\w+|diplomat\w*|diplomazi\w+|summit|vertice|G7|G20|treaty|trattato|defen[cs]e|difesa|pact|patto|border|confine|refugee\w*|rifugiat\w+|migrant\w*|migranti|geopolitic\w*|geopolitica|Gaza|Hamas|Hezbollah|Iran|Israel\w*|Israele|Ukrain\w*|Ucraina|Russia\w*|Putin|Zelensky\w*|Kremlin|Cremlino|China|Cina|Taiwan|Xi Jinping|North Korea|Corea del Nord|Syria|Siria|Yemen|Houthi\w*|Venezuela|Sudan)\b`),
};

export const CC_RX = {
  us: R(String.raw`\b(USA|U\.S\.|US|United States|Stati Uniti|America\w*|american[oiae]|statunitens\w|Washington|White House|Casa Bianca|Trump|Vance|Biden|Congress|Pentagon\w*|Pentagono|Wall Street|Fed|Federal Reserve|New York|California|Texas|Florida|Senate|Supreme Court|FBI|CIA)\b`),
  it: R(String.raw`\b(Italy|Italia|Italian\w*|italian[oiae]|Roma|Rome|Milano|Milan|Napoli|Torino|Meloni|Mattarella|Schlein|Salvini|Tajani|Palazzo Chigi|Quirinale|Ftse Mib|Piazza Affari|BTP|Bankitalia|Istat)\b`),
  ch: R(String.raw`\b(Svizzera|Switzerland|Swiss|svizzer\w|Schweiz|Suisse|Berna|Bern|Zurigo|Zurich|Z[uü]rich|Ginevra|Geneva|Lugano|Ticino|Basilea|Basel|Losanna|Lausanne|Davos|UBS|Nestl[eé]|Novartis|Roche|BNS|SNB|Consiglio federale|Swatch)\b`),
  eu: R(String.raw`\b(EU|UE|European Union|Unione Europea|European Commission|Commissione europea|Commissione Ue|Brussels|Bruxelles|von der Leyen|Kallas|European Parliament|Parlamento europeo|Eurozone|Eurozona|ECB|BCE|Lagarde|Strasburgo|Strasbourg)\b`),
  uk: R(String.raw`\b(UK|U\.K\.|United Kingdom|Regno Unito|Britain|British|Gran Bretagna|britannic\w+|England|Inghilterra|London|Londra|Scotland|Scozia|Wales|Starmer|Downing Street|Westminster|Bank of England|FTSE 100)\b`),
  de: R(String.raw`\b(Germany|German|Germania|tedesc\w+|Berlin|Berlino|Munich|Monaco di Baviera|Frankfurt|Francoforte|Hamburg|Amburgo|Merz|Scholz|Bundestag|Bundesbank|Dax|Volkswagen|Siemens|AfD)\b`),
  es: R(String.raw`\b(Spain|Spanish|Spagna|spagnol\w|Madrid|Barcelona|Barcellona|Catalonia|Catalogna|S[aá]nchez|Ibex)\b`),
  fr: R(String.raw`\b(France|French|Francia|frances\w|Paris|Parigi|Macron|[EÉ]lys[eé]e|Marseille|Marsiglia|Lyon|Lione|Le Pen|Bayrou|Cac 40)\b`),
  ru: R(String.raw`\b(Russia|Russian|Russo|russ[aie]|Moscow|Mosca|Kremlin|Cremlino|Putin|Lavrov|Peskov|Medvedev)\b`),
  ua: R(String.raw`\b(Ukraine|Ukrainian|Ucraina|ucrain\w+|Kyiv|Kiev|Zelensky\w*|Zelenskyy|Kharkiv|Kharkov|Odesa|Odessa|Donbas|Donbass|Crimea|Zaporizhzhia)\b`),
  cn: R(String.raw`\b(China|Chinese|Cina|cines\w|Beijing|Pechino|Shanghai|Hong Kong|Xi Jinping|Xi|Taiwan|Huawei|Alibaba|Tencent|BYD)\b`),
  il: R(String.raw`\b(Israel|Israele|Israeli|israelian\w|Netanyahu|Tel Aviv|Jerusalem|Gerusalemme|IDF|Gaza|Hamas|West Bank|Cisgiordania)\b`),
  me: R(String.raw`\b(Middle East|Medio Oriente|Iran|Iranian|iranian\w|Tehran|Teheran|Saudi|Arabia Saudita|Riyadh|Qatar|Doha|UAE|Emirati|Dubai|Syria|Siria|Lebanon|Libano|Hezbollah|Iraq|Yemen|Houthi\w*|Jordan|Giordania|Egypt|Egitto|Gaza)\b`),
  in: R(String.raw`\b(India|Indian|indian\w|New Delhi|Delhi|Mumbai|Modi|Bangalore|Bengaluru)\b`),
  jp: R(String.raw`\b(Japan|Japanese|Giappone|giappones\w|Tokyo|Osaka|Nikkei|Ishiba|Takaichi|Toyota|Sony|Nintendo)\b`),
  br: R(String.raw`\b(Brazil|Brazilian|Brasile|brasilian\w|Brasilia|S[aã]o Paulo|Rio de Janeiro|Lula|Bolsonaro|Bel[eé]m)\b`),
  tr: R(String.raw`\b(Turkey|T[uü]rkiye|Turkish|Turchia|turc[oaih]\w*|Ankara|Istanbul|Erdogan|Erdo[gğ]an)\b`),
};

const SPORT = R(String.raw`\b(football|soccer|calcio|Serie A|Premier League|Champions League|Europa League|Nations League|World Cup|Mondiali|Euro 2028|rugby|Springboks|Six Nations|cricket|NBA|NFL|NHL|MLB|tennis|ATP|WTA|Sinner|Formula 1|F1|MotoGP|Gran Premio|golf|Olympic\w*|Olimpiadi|Turkey Trot|match|partita|kick-off|calcio d'inizio|goal|gol|striker|coach|allenatore|quarterback|playoff\w*|semifinal\w*|semifinale|finale|Juventus|Inter|Milan|Napoli|Roma|Lazio|Real Madrid|Barcelona|Bayern|Liverpool|Arsenal|Chelsea)\b`);
const SPORT_STRONG = R(String.raw`\b(Nations League|Champions League|Serie A|Premier League|World Cup|Mondiali|rugby|Springboks|cricket|NBA|NFL|tennis|ATP|WTA|Formula 1|MotoGP|Turkey Trot|kick-off|how to watch|live stream|streaming live|Matchday)\b`);
export function classify(text, feed){
  // lo sport finisce in "Altro" (non è politica né tecnologia)
  if (SPORT_STRONG.test(text) || (SPORT.test(text) && /\b(vs\.?|v\.|contro)\b/i.test(text))) return { cats: ["altro"], cc: [] };
  const cats = Object.keys(CAT_RX).filter(k => CAT_RX[k].test(text));
  if (!cats.length) cats.push(feed.cat || "altro");
  else if (feed.cat && !cats.includes(feed.cat) && feed.cat !== "esteri") cats.push(feed.cat);
  const cc = new Set(feed.cc || []);
  for (const k of Object.keys(CC_RX)) if (CC_RX[k].test(text)) cc.add(k);
  if (!cc.size && feed.home) cc.add(feed.home);
  // un fatto di un paese diverso da quello dell'utente è "esteri"
  if ([...cc].some(c => !["it", "ch"].includes(c)) && (cats.includes("politica") || feed.cat === "esteri") && !cats.includes("esteri")) cats.push("esteri");
  return { cats, cc: [...cc] };
}

/* ---------- lettura RSS / Atom ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decode = s => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const strip = s => decode(decode(s)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? m[1] : ""; };
const attr = (x, t, a) => { const m = x.match(new RegExp(`<${t}\\b[^>]*\\b${a}="([^"]*)"`, "i")); return m ? decode(m[1]) : ""; };

export function parseFeed(xml, feed){
  const out = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks){
    let t = strip(tag(b, "title"));
    let u = strip(tag(b, "link")) || attr(b, "link", "href");
    const d = Date.parse(strip(tag(b, "pubDate") || tag(b, "dc:date") || tag(b, "published") || tag(b, "updated")));
    let s = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content"));
    let src = feed.n, srcUrl = "";
    const gsrc = b.match(/<source\b[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);
    if (gsrc){ src = strip(gsrc[2]); srcUrl = decode(gsrc[1]); }
    if (feed.n === "Google News"){
      // Google mette " - Testata" in fondo al titolo e nella descrizione solo il link
      if (src && t.endsWith(" - " + src)) t = t.slice(0, -(src.length + 3));
      s = "";
    }
    if (!t || !u || !Number.isFinite(d)) continue;
    if (s.length > 320) s = s.slice(0, 317).replace(/\s\S*$/, "") + "…";
    if (s === t) s = "";
    out.push({ t, u, d, s, src, srcUrl, feed });
  }
  return out;
}

/* ---------- raggruppare lo stesso fatto ---------- */
const STOP = new Set(("the a an and or of to in on for with at by from as is are was were be been has have had will would after before over under into about says said new more than this that its it his her their they he she we you not no but also amid how why what who when where which just up out off may could can could than del della delle dei degli dello di da in con per tra fra su sul sulla nel nella nei negli alla alle agli allo il lo la i gli le un uno una e ed o che non come dopo prima anche più sono è stato stata stati essere ha hanno era al ai si se ma del per questo questa quello quella oggi ieri video foto ecco cosa chi dove quando perché news live update updates").split(" "));
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const tokens = t => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)).map(w => w.length > 6 ? w.slice(0, 6) : w));
// parole rare pesano di più: "Russia" o "Ukraine" da sole non bastano a dire che è lo stesso fatto
let IDF = new Map();
const w8 = w => IDF.get(w) ?? 1;
function similar(a, b){
  let n = 0, sh = 0, wa = 0, wb = 0;
  for (const w of a){ wa += w8(w); if (b.has(w)){ n++; sh += w8(w); } }
  for (const w of b) wb += w8(w);
  return n >= 3 && sh / Math.min(wa, wb) >= 0.55;
}

export function cluster(items){
  items.sort((a, b) => b.d - a.d);
  for (const it of items) it.k = tokens(it.t);
  const df = new Map(); for (const it of items) for (const w of it.k) df.set(w, (df.get(w) || 0) + 1);
  IDF = new Map([...df].map(([w, c]) => [w, Math.log((items.length + 1) / c)]));
  const groups = [];
  for (const it of items){
    let g = groups.find(g => g.k.size && it.k.size && similar(g.k, it.k));
    if (!g){ g = { items: [], k: it.k }; groups.push(g); }
    g.items.push(it);
  }
  return groups.map(g => {
    const srcs = []; const seen = new Set();
    for (const it of g.items) if (!seen.has(norm(it.src))){ seen.add(norm(it.src)); srcs.push([it.src, it.u]); }
    // titolo: la versione con descrizione più ricca, preferendo una testata diretta a Google News
    const lead = [...g.items].sort((a, b) => (b.s.length > 40) - (a.s.length > 40) || (a.feed.n === "Google News") - (b.feed.n === "Google News") || a.d - b.d)[0];
    // categoria e paese "a maggioranza", così un titolo fuori tema non sporca tutto il gruppo
    const vc = {}, vp = {};
    for (const it of g.items){ const c = classify(it.t + " " + it.s, it.feed); c.cats.forEach(x => vc[x] = (vc[x] || 0) + 1); c.cc.forEach(x => vp[x] = (vp[x] || 0) + 1); }
    const N = g.items.length;
    const cats = new Set(Object.keys(vc).filter(k => vc[k] >= Math.max(1, N * 0.34)));
    const cc = new Set(Object.keys(vp).filter(k => vp[k] >= Math.max(1, N * 0.25)));
    if (!cats.size) cats.add(Object.keys(vc).sort((a, b) => vc[b] - vc[a])[0] || "altro");
    if (cats.size > 1) cats.delete("altro");
    const first = Math.min(...g.items.map(i => i.d)), last = Math.max(...g.items.map(i => i.d));
    const alt = [...new Set(g.items.map(i => i.t))].filter(t => t !== lead.t).slice(0, 4);
    return { t: lead.t, u: lead.u, src: lead.src, s: lead.s, d: last, d0: first, n: srcs.length, srcs: srcs.slice(0, 10), alt, cats: [...cats], cc: [...cc] };
  });
}

/* ---------- download ---------- */
async function get(url){
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; MiaDashboardNews/1.0)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}

async function main(){
  const now = Date.now(), all = [], report = [];
  const queue = [...FEEDS];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let f; (f = queue.shift());){
      try { const items = parseFeed(await get(f.u), f); all.push(...items); report.push(`ok   ${String(items.length).padStart(3)}  ${f.n}  ${f.u}`); }
      catch (e){ report.push(`ERR       ${f.n}  ${f.u}  ${e.message}`); }
    }
  }));
  console.log(report.sort().join("\n"));
  const got = all.filter(i => i.d <= now + 3600e3);
  if (got.length < 50){
    console.error(`Troppo poche notizie (${got.length}): tengo il file precedente.`);
    process.exitCode = 1; return;
  }
  // titoli dei giri precedenti (servono per ieri e l'altro ieri, che i feed non danno più)
  const FB = new Map(FEEDS.map(f => [f.u, f]));
  let raw = []; try { raw = JSON.parse(await readFile(RAW, "utf8")).map(r => ({ ...r, feed: FB.get(r.f) || { n: r.src } })); } catch {}
  const keep = new Set([0, 1, 2].slice(0, DAYS).map(k => dayOf(now - k * 864e5)));
  const byUrl = new Map();
  for (const it of [...raw, ...got]) if (keep.has(dayOf(it.d))) byUrl.set(it.u, it);
  const items = [...byUrl.values()];
  // ogni giorno ha la sua classifica
  const out = [];
  for (const day of keep){
    const g = cluster(items.filter(i => dayOf(i.d) === day));
    g.sort((a, b) => b.n - a.n || b.d - a.d);
    for (const x of g.slice(0, PER_DAY)) out.push({ ...x, day });
  }
  await writeFile(RAW, JSON.stringify(items.map(({ t, u, d, s, src, srcUrl, feed }) => ({ t, u, d, s, src, srcUrl, f: feed.u }))));
  const data = { updated: new Date(now).toISOString(), days: [...keep], feeds: FEEDS.length, ok: report.filter(r => r.startsWith("ok")).length, items: out };
  await writeFile(OUT, JSON.stringify(data));
  console.log(`Scritte ${out.length} notizie da ${items.length} titoli in memoria (${data.ok}/${FEEDS.length} feed).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
