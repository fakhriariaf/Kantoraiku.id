// replica/design/tokens.json -> apps/web/src/styles/tokens.css
// Satu sumber kebenaran: ubah tokens.json (mis. saat /replica-brand), lalu `pnpm tokens`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "replica/design/tokens.json");
const out = resolve(root, "apps/web/src/styles/tokens.css");
const t = JSON.parse(readFileSync(src, "utf8"));
const px = (n) => `${n}px`;
const pub = (o) => Object.entries(o).filter(([k]) => !k.startsWith("_"));

const vars = [];
const theme = [];

for (const [k, v] of pub(t.color)) {
  vars.push(`--k-color-${k}: ${v};`);
  theme.push(`--color-${k}: var(--k-color-${k});`);
}

vars.push(`--k-font-sans: ${t.font.sans};`, `--k-font-mono: ${t.font.mono};`);
// next/font menaruh nama font self-hosted di --font-jakarta / --font-jetbrains (lihat layout.tsx)
theme.push(
  `--font-sans: var(--font-jakarta), var(--k-font-sans);`,
  `--font-mono: var(--font-jetbrains), var(--k-font-mono);`,
);

for (const [k, s] of pub(t.type)) {
  theme.push(`--text-${k}: ${px(s.size)};`, `--text-${k}--line-height: ${px(s.line)};`);
  if (s.weight) theme.push(`--text-${k}--font-weight: ${s.weight};`);
  if (s.tracking) theme.push(`--text-${k}--letter-spacing: ${s.tracking};`);
}

for (const [k, v] of pub(t.radius)) theme.push(`--radius-${k}: ${px(v)};`);
for (const [k, v] of pub(t.shadow)) theme.push(`--shadow-${k}: ${v};`);

const L = t.layout;
theme.push(
  `--container-page: ${px(L.container)};`,
  `--spacing-header: ${px(L.header)};`,
  `--spacing-sidebar: ${px(L.sidebar)};`,
  `--spacing-bottom-nav: ${px(L["bottom-nav"])};`,
  `--spacing-control-sm: ${px(L["control-height"].sm)};`,
  `--spacing-control-md: ${px(L["control-height"].md)};`,
  `--spacing-control-lg: ${px(L["control-height"].lg)};`,
  `--ease-standard: ${t.motion.ease};`,
  `--default-transition-duration: ${t.motion.base};`,
  `--default-transition-timing-function: ${t.motion.ease};`,
);
vars.push(
  `--k-motion-fast: ${t.motion.fast};`,
  `--k-motion-base: ${t.motion.base};`,
  `--k-motion-slow: ${t.motion.slow};`,
  `--k-z-header: ${t.z.header};`,
  `--k-z-overlay: ${t.z.overlay};`,
  `--k-z-toast: ${t.z.toast};`,
  `--k-gutter: ${px(L.gutter.mobile)};`,
);

const display = t.type.display;
const css = `/* DIBUAT OTOMATIS dari replica/design/tokens.json. Jangan diedit: ubah JSON, lalu \`pnpm tokens\`. */

:root {
  ${vars.join("\n  ")}
}

@media (min-width: ${px(L.breakpoints.md)}) {
  :root { --k-gutter: ${px(L.gutter.desktop)}; }
}

@theme inline {
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --color-black: #000;
  --color-white: #fff;
  ${theme.join("\n  ")}
}

/* Display mengecil di HP */
@media (max-width: ${px(L.breakpoints.md - 1)}) {
  :root { --text-display: ${px(display.mobile.size)}; --text-display--line-height: ${px(display.mobile.line)}; }
}
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, css);
console.log(`tokens.css ditulis: ${out}`);
