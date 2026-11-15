// Bundel proses utama, preload, dan tampilan ke dist/. Semua dependensi ikut dibundel, jadi installer
// tidak membawa node_modules (FFmpeg ditambahkan terpisah lewat extraResources).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const server = process.env.KANTORAIKU_SERVER || "https://kantoraiku.id";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/ui", { recursive: true });

const common = { bundle: true, platform: "node", target: "node22", format: "cjs", logLevel: "warning", sourcemap: "linked" };

await build({
  ...common,
  entryPoints: { main: "src/main.ts" },
  outExtension: { ".js": ".cjs" },
  outdir: "dist",
  external: ["electron", "ffmpeg-static"],
  // Kode runner memakai import.meta.url (ESM); di bundel CJS diganti dengan URL file bundel.
  define: { "import.meta.url": "__import_meta_url", __DEFAULT_SERVER__: JSON.stringify(server) },
  banner: { js: 'const __import_meta_url = require("node:url").pathToFileURL(__filename).href;' },
});
await build({ ...common, entryPoints: { preload: "src/preload.ts" }, outExtension: { ".js": ".cjs" }, outdir: "dist", external: ["electron"] });
await build({ ...common, platform: "browser", format: "iife", target: "chrome130", entryPoints: { ui: "src/ui/ui.ts" }, outdir: "dist/ui" });
cpSync("src/ui/index.html", "dist/ui/index.html");
cpSync("src/ui/styles.css", "dist/ui/styles.css");
console.log(`dist/ siap (server bawaan: ${server})`);
