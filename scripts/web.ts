import { copyFileSync, createReadStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { build } from "esbuild";

const OUT = "dist";
mkdirSync(OUT, { recursive: true });
await build({
  entryPoints: ["web/app.ts"], bundle: true, format: "esm", target: "es2022", minify: true, outfile: `${OUT}/app.js`,
  loader: { ".cypher": "text" },
});
copyFileSync("web/index.html", `${OUT}/index.html`);
copyFileSync("node_modules/@relate/relate-wasm/relate_bg.wasm", `${OUT}/relate_bg.wasm`);
for (const f of ["dataset.json", "vectors.json"]) copyFileSync(`data/${f}`, `${OUT}/${f}`);

if (process.argv.includes("--serve")) {
  const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".wasm": "application/wasm", ".json": "application/json",
  };
  const port = Number(process.env.PORT ?? 8787);
  createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const file = join(OUT, normalize(path === "/" ? "/index.html" : path));
    if (!file.startsWith(OUT) || !existsSync(file) || !TYPES[extname(file)]) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] });
    createReadStream(file).pipe(res);
  }).listen(port, "127.0.0.1", () => console.log(`PaidOnce on http://127.0.0.1:${port}`));
}
