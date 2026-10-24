var dir = "/tmp/claude-0/-home-user-test/478ae8c0-2492-55cb-9e31-616ef7cceb66/scratchpad/proj5/ec/";
function imp(n) { return app.project.importFile(new ImportOptions(new File(dir + n))); }
var c5 = app.project.items.addComp("MEGA", 1152, 2048, 1, 5.6, 30);
var b5 = c5.layers.add(imp("a12_bg.png")); b5.name = "BG";
var boy = c5.layers.add(imp("a12_fig.png")); boy.name = "BOY";
app.project.save(new File(dir + "v4.ecproj"));
