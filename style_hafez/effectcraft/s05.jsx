// Composition EffectCraft : scène de la tombe, deux hommes découpés posés sur le fond retouché
var dir = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/proj/ec/";
var comp = app.project.items.addComp("Main", 1152, 2048, 1, 5, 30);
function imp(n) { return app.project.importFile(new ImportOptions(new File(dir + n))); }
var bg = comp.layers.add(imp("s05_bg.png")); bg.name = "BG";
var p0 = comp.layers.add(imp("person0.png")); p0.name = "P0";
var p4 = comp.layers.add(imp("person4.png")); p4.name = "P4";
app.project.save(new File(dir + "s05.ecproj"));
