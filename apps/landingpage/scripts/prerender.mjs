import { readFile, writeFile, mkdir } from "node:fs/promises";
import { loadEnv } from "vite";
import { Resvg } from "@resvg/resvg-js";
import { create as createFont } from "fontkit";
import { createSiteConfig } from "./site-config.mjs";
import {
  renderPage,
  pageTitles,
  pageForPath,
} from "../.prerender/entry-server.js";

const legal = JSON.parse(await readFile("content/legal.json", "utf8"));
const config = createSiteConfig(
  { ...loadEnv("production", process.cwd(), ""), ...process.env },
  legal,
);
const template = await readFile("dist/index.html", "utf8");
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const description =
  "Räume, Lehrpläne, Jahrgänge, Unterricht und Prüfungen gemeinsam planen. Entdecken Sie CampusZeit für Hochschulen und Schulen in der Browser-Demo.";
const routes = [
  ["/", "index.html"],
  ["/impressum/", "impressum/index.html"],
  ["/datenschutz/", "datenschutz/index.html"],
  ["/404.html", "404.html"],
];

for (const [path, filename] of routes) {
  const page = pageForPath(path);
  const indexable = config.publicRelease && page !== "notfound";
  const canonical =
    config.siteUrl && page !== "notfound" ? config.siteUrl + path : "";
  const title = pageTitles[page];
  const metadata = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="${indexable ? "index, follow" : "noindex, nofollow"}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="de_DE">',
    '<meta property="og:site_name" content="CampusZeit">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    ...(canonical
      ? [
          `<link rel="canonical" href="${escapeHtml(canonical)}">`,
          `<meta property="og:url" content="${escapeHtml(canonical)}">`,
        ]
      : []),
    ...(config.siteUrl
      ? [
          `<meta property="og:image" content="${escapeHtml(config.siteUrl)}/social-preview.png">`,
          '<meta property="og:image:width" content="1200">',
          '<meta property="og:image:height" content="630">',
          '<meta property="og:image:alt" content="CampusZeit: Stundenpläne, Räume und Prüfungen gemeinsam planen">',
        ]
      : []),
  ].join("\n    ");
  const initialData = JSON.stringify({ path, config }).replaceAll(
    "<",
    "\\u003c",
  );
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace("<!--page-meta-->", metadata)
    .replace("<!--app-html-->", renderPage(path, config))
    .replace(
      "<!--site-data-->",
      `<script id="site-data" type="application/json">${initialData}</script>`,
    );
  const target = `dist/${filename}`;
  await mkdir(target.substring(0, target.lastIndexOf("/")), {
    recursive: true,
  });
  await writeFile(target, html);
}

const sitemapRoutes = config.publicRelease
  ? routes
      .filter(([path]) => path !== "/404.html")
      .map(
        ([path]) =>
          `<url><loc>${escapeHtml(config.siteUrl + path)}</loc></url>`,
      )
      .join("\n")
  : "";
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapRoutes}</urlset>\n`,
);
await writeFile(
  "dist/robots.txt",
  config.publicRelease
    ? `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n",
);
const fonts = {
  brand: createFont(
    await readFile(
      "node_modules/@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff2",
    ),
  ),
  heading: createFont(
    await readFile(
      "node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff2",
    ),
  ),
  body: createFont(
    await readFile(
      "node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2",
    ),
  ),
};
const svgSource = await readFile("public/social-preview.svg", "utf8");
// Embed glyph outlines so the share image renders identically without system fonts.
const svg = svgSource.replace(
  /<text\s+([^>]+)>([^<]+)<\/text>/g,
  (_match, attributes, text) => {
    const attr = (name, fallback = "") =>
      attributes.match(new RegExp(`${name}="([^"]+)"`))?.[1] || fallback;
    const font =
      attr("font-family") === "DM Sans"
        ? attr("font-weight") === "800"
          ? fonts.brand
          : fonts.body
        : fonts.heading;
    const scale = Number(attr("font-size", "60")) / font.unitsPerEm;
    const tracking = Number(attr("letter-spacing", "0")) / scale;
    const run = font.layout(text);
    let advance = 0;
    const paths = run.glyphs
      .map((glyph, index) => {
        const position = run.positions[index];
        const path = `<path transform="translate(${advance + position.xOffset} ${position.yOffset})" d="${glyph.path.toSVG()}"></path>`;
        advance += position.xAdvance + tracking;
        return path;
      })
      .join("");
    return `<g transform="translate(${attr("x")} ${attr("y")}) scale(${scale} ${-scale})"${attr("fill") ? ` fill="${attr("fill")}"` : ""}>${paths}</g>`;
  },
);
await writeFile("dist/social-preview.svg", svg);
const image = new Resvg(svg, { font: { loadSystemFonts: false } })
  .render()
  .asPng();
await writeFile("dist/social-preview.png", image);
console.log(
  `4 HTML-Seiten statisch erzeugt. Modus: ${config.publicRelease ? "öffentlich" : "Entwurf (noindex)"}.`,
);
