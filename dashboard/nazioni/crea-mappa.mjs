import fs from "fs";
import * as d3 from "d3-geo";
import { topology } from "topojson-server";
import { presimplify, simplify, quantile } from "topojson-simplify";
import { feature, merge } from "topojson-client";
const g = JSON.parse(fs.readFileSync("ne50.geojson"));
const EXCL_TYPE = new Set(["AW","CW","SX","GL","HK","MO","GG","IM","JE","AX"]);
const NAMES = { US:"Stati Uniti", MM:"Myanmar", SZ:"Eswatini", MC:"Monaco", VA:"Vaticano", FM:"Micronesia", CD:"Rep. Dem. del Congo", CG:"Congo", CZ:"Repubblica Ceca", BA:"Bosnia ed Erzegovina", TL:"Timor Est", ST:"São Tomé e Príncipe", RW:"Ruanda", KN:"Saint Kitts e Nevis", VC:"Saint Vincent e Grenadine", BH:"Bahrein", CF:"Rep. Centrafricana", DO:"Rep. Dominicana" };
const CONT = { "Europe":"eu","Asia":"as","Africa":"af","North America":"na","South America":"sa","Oceania":"oc" };
const CONT_FIX = { MU:"af", SC:"af", MV:"as", CY:"eu" };
// fondo Somaliland in Somalia e Cipro del Nord in Cipro
for (const f of g.features){ const a=f.properties.ADM0_A3; if(a==="SOL") f.properties.ISO_A2_EH="SO"; if(a==="CYN") f.properties.ISO_A2_EH="CY"; if(a==="KAS") f.properties.ISO_A2_EH="IN"; }
const feats = g.features.filter(f => f.properties.ADM0_A3 !== "ATA" && f.properties.ISO_A2_EH !== "-99");
const objs = {};
const info = {};
for (const f of feats){
  const p=f.properties, k=p.ISO_A2_EH==="-99"?p.ADM0_A3:p.ISO_A2_EH;
  const key = objs[k] ? k : k;
  (objs[key] = objs[key] || []).push(f);
  const quiz = !["Dependency","Indeterminate","Disputed"].includes(p.TYPE) && !EXCL_TYPE.has(k) || ["PS","XK","IL"].includes(k);
  const prim = !["SOL","CYN","KAS"].includes(p.ADM0_A3) && p.TYPE!=="Dependency" || p.ADM0_A3==="PSX";
  if (!info[k] || (prim && !info[k].prim)) info[k] = { prim, k, n: NAMES[k]||p.NAME_IT, en: p.NAME_LONG||p.NAME, en2: p.NAME, c: CONT_FIX[k]||CONT[p.CONTINENT]||"x", q: quiz, sub: p.SUBREGION, pop: p.POP_EST };
}
// geometria unita per paese
const fc = { type:"FeatureCollection", features: Object.entries(objs).map(([k,fs])=>({type:"Feature",id:k,properties:{},geometry: fs.length===1?fs[0].geometry:{type:"MultiPolygon",coordinates: fs.flatMap(f=>f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates)}})) };
let topo = topology({ c: fc }, 1e5);
topo = presimplify(topo);
// i paesi piccoli tengono tutti i punti
{ const small = new Set(fc.features.filter(f=>d3.geoArea(f) < 2e-5).map(f=>f.id));
  const arcsOf = g => { const s=[]; const walk=a=>Array.isArray(a)?a.forEach(walk):s.push(a<0?~a:a); walk(g.arcs); return s; };
  for (const geo of topo.objects.c.geometries) if (small.has(geo.id)) for (const ai of arcsOf(geo)) for (const pt of topo.arcs[ai]) pt[2]=Infinity;
  console.log("piccoli", small.size); }
topo = simplify(topo, quantile(topo, +process.argv[2] || 0.25));
const fc2 = feature(topo, topo.objects.c);
const W=1000, H=520;
const proj = d3.geoNaturalEarth1().fitExtent([[4,4],[W-4,H-4]], {type:"Sphere"});
// taglio l'Antartide: niente; ricalcolo altezza
const path = d3.geoPath(proj).digits(1);
const out = [];
for (const f of fc2.features){
  const k=f.id, i=info[k]; const d = (path.area(f)<6 ? d3.geoPath(proj).digits(2) : path)(f); if(!d) continue;
  // poligono più grande per centro e inquadratura
  const polys = f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
  let best=null, ba=-1; for (const pc of polys){ const gf={type:"Polygon",coordinates:pc}; const a=path.area(gf); if(a>ba){ba=a;best=gf;} }
  // per l'inquadratura uso i poligoni grandi almeno 1/8 del più grande
  const big = polys.map(pc=>({type:"Polygon",coordinates:pc})).filter(gf=>path.area(gf)>=ba/8);
  const bb = path.bounds({type:"GeometryCollection",geometries:big});
  const ctr = path.centroid(best), ll = d3.geoCentroid(best);
  const area = path.area(f);
  const {prim,...ii}=i; out.push({ ...ii, d, x:+ctr[0].toFixed(1), y:+ctr[1].toFixed(1), b: bb.flat().map(v=>+v.toFixed(1)), a:+area.toFixed(2), ll: ll.map(v=>+v.toFixed(2)) });
}
// confini del mondo (sfera) per lo sfondo
const sphere = path({type:"Sphere"});
const grat = path(d3.geoGraticule10());
fs.writeFileSync(process.argv[3]||"mappa.json", JSON.stringify({W,H,sphere,grat,c:out}));
console.log(out.length, out.filter(o=>o.q).length, fs.statSync("mappa.json").size);
const qs = out.filter(o=>o.q).map(o=>o.k).sort(); console.log(qs.join(" "));
console.log(out.filter(o=>o.q && o.a<4).map(o=>o.k+":"+o.a).join(" "));
