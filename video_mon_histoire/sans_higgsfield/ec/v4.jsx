var dir = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/proj5/ec/";
function imp(n) { return app.project.importFile(new ImportOptions(new File(dir + n))); }
// --- bombardement
var c1 = app.project.items.addComp("BOMB", 1152, 2048, 1, 2.6, 30);
var shake = c1.layers.addNull(); shake.name = "SHAKE";
var bg = c1.layers.add(imp("a4.png")); bg.name = "BG";
var sm = c1.layers.add(imp("a4_smoke.png")); sm.name = "SMOKE";
var bu = c1.layers.add(imp("a4_burst.png")); bu.name = "BURST";
var deb = c1.layers.addSolid([0,0,0], "DEBRIS", 1152, 2048, 1);
deb.Effects.addProperty("CC Particle World");
bu.Effects.addProperty("ADBE Turbulent Displace"); bu.Effects.addProperty("ADBE Glo2");
sm.Effects.addProperty("ADBE Turbulent Displace");
// --- survivant (marionnette)
var c2 = app.project.items.addComp("SURV", 1152, 2048, 1, 4.9, 30);
var b2 = c2.layers.add(imp("a5_bg.png")); b2.name = "BG";
var man = c2.layers.add(imp("a5_fig.png")); man.name = "MAN";
// --- gaz chimique
var c3 = app.project.items.addComp("GAS", 1152, 2048, 1, 4.7, 30);
var b3 = c3.layers.add(imp("a8.png")); b3.name = "BG";
var cl = c3.layers.add(imp("a8_cloud.png")); cl.name = "CLOUD";
cl.Effects.addProperty("ADBE Turbulent Displace");
var fog = c3.layers.addSolid([0,0,0], "FOG", 1152, 2048, 1);
fog.Effects.addProperty("ADBE Fractal Noise");
// --- camp sous la neige
var c4 = app.project.items.addComp("CAMP", 1152, 2048, 1, 3.3, 30);
var b4 = c4.layers.add(imp("a10.png")); b4.name = "BG";
var sn = c4.layers.addSolid([0,0,0], "SNOW", 1152, 2048, 1);
sn.Effects.addProperty("CC Snowfall");
bg.parent = shake; sm.parent = shake; bu.parent = shake;
deb.blendingMode = BlendingMode.SCREEN; fog.blendingMode = BlendingMode.SCREEN; sn.blendingMode = BlendingMode.SCREEN;
fog.opacity.setValue(38);
shake.position.expression = "var a = Math.max(0, 1 - time / 1.6); [576 + a * 18 * Math.sin(time * 61), 1024 + a * 14 * Math.cos(time * 53)]";
bu.scale.expression = "var s = 92 + 14 * Math.min(time / 0.5, 1); [s, s]";
app.project.save(new File(dir + "v4.ecproj"));
