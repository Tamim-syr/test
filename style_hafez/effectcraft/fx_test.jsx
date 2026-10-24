var dir = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/proj/ec/";
var comp = app.project.items.addComp("Fx", 1152, 2048, 1, 4, 30);
function imp(n) { return app.project.importFile(new ImportOptions(new File(dir + n))); }
var bg = comp.layers.add(imp("s04.png")); bg.name = "BG";
var fire = comp.layers.add(imp("s04_fire.png")); fire.name = "FIRE";
var td = fire.Effects.addProperty("ADBE Turbulent Displace");
var gl = fire.Effects.addProperty("ADBE Glo2");
var pw = comp.layers.addSolid([0,0,0], "EMBERS", 1152, 2048, 1); 
var cc = pw.Effects.addProperty("CC Particle World");
app.project.save(new File(dir + "fx.ecproj"));
