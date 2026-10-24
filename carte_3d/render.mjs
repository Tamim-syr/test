// node render.mjs <port> <out.mp4|frames:t1,t2,..> [t0 t1]
import { chromium } from "playwright"; import { spawn } from "child_process"; import fs from "fs";
const [port, out, a = "0", b = "38"] = process.argv.slice(2);
const br = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const PAGE = process.env.PAGE || "index.html", VW = +(process.env.VW || 1080), VH = +(process.env.VH || 1920);
const pg = await br.newPage({ viewport: { width: VW, height: VH } });
pg.on("console", m => { if (m.type() === "error") console.error("PAGE:", m.text()); }); pg.on("pageerror", e => console.error("ERR:", e.message));
await pg.goto(`http://localhost:${port}/${PAGE}`); await pg.waitForFunction("window.ready === true", null, { timeout: 180000 });
if (out.startsWith("frames:")) {
  for (const t of out.slice(7).split(",")) { const s = Date.now(); await pg.evaluate(t => window.setT(t), +t); await pg.screenshot({ path: `fr_${t}.jpg`, type: "jpeg", quality: 90 }); console.log(t, Date.now() - s, "ms"); }
} else {
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  const f0 = Math.round(+a * 30), f1 = Math.round(+b * 30);
  for (let f = f0; f < f1; f++) {
    await pg.evaluate(t => window.setT(t), f / 30);
    const buf = await pg.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 60 === 0) console.log(out, f);
  }
  ff.stdin.end(); await new Promise(r => ff.on("close", r));
}
await br.close();
