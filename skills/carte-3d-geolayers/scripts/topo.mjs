import fs from "fs"; import { feature } from "topojson-client";
const t = JSON.parse(fs.readFileSync("node_modules/world-atlas/countries-10m.json"));
const fc = feature(t, t.objects.countries);
const want = {"760":"SYR","422":"LBN","376":"ISR","400":"JOR","368":"IRQ","792":"TUR","196":"CYP","275":"PSE","818":"EGY","682":"SAU"};
const out = fc.features.filter(f => want[f.id]).map(f => ({id: want[f.id], name: f.properties.name, geometry: f.geometry}));
fs.writeFileSync("countries.json", JSON.stringify(out)); console.log(out.map(o => o.id + ":" + o.geometry.type).join(" "));
