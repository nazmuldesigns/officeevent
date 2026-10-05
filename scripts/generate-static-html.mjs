import { readdirSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const staticDir = join(root, ".vercel/output/static");
const assetsDir = join(staticDir, "assets");

if (!existsSync(assetsDir)) {
  console.error("Assets directory not found at:", assetsDir);
  process.exit(1);
}

const files = readdirSync(assetsDir);
const mainCss = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));
const mainJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const runtimeJs = files.find((f) => f.startsWith("rolldown-runtime-") && f.endsWith(".js"));

console.log("Found production assets:", { mainCss, mainJs, runtimeJs });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
  <title>NRB World Event - Verification &amp; Check-in</title>
  <meta name="theme-color" content="#070D1E" />
  <meta name="description" content="Event Registration, Verification &amp; Check-in System" />
  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="apple-touch-icon" href="/logo.png" />
  <link rel="manifest" href="/__grok/manifest.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&amp;family=Outfit:wght@400;500;600;700;800&amp;display=swap" />
  ${mainCss ? `<link rel="stylesheet" href="/assets/${mainCss}" />` : ""}
  ${runtimeJs ? `<link rel="modulepreload" href="/assets/${runtimeJs}" />` : ""}
  ${mainJs ? `<link rel="modulepreload" href="/assets/${mainJs}" />` : ""}
</head>
<body class="antialiased selection:bg-primary/25 selection:text-primary">
  <div id="root"></div>
  ${mainJs ? `<script type="module" src="/assets/${mainJs}"></script>` : ""}
</body>
</html>`;

writeFileSync(join(staticDir, "index.html"), html, "utf8");
console.log("Successfully generated:", join(staticDir, "index.html"));

// Also copy to .output/public/
const outputPublicDir = join(root, ".output/public");
mkdirSync(outputPublicDir, { recursive: true });
writeFileSync(join(outputPublicDir, "index.html"), html, "utf8");
