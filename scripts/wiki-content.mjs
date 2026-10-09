import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const directory = path.join(root, "shared/wiki");
const catalog = JSON.parse(
  await fs.readFile(path.join(directory, "catalog.json"), "utf8"),
);
const ids = new Set(catalog.map((item) => item.id));
assert.equal(ids.size, catalog.length, "Duplicate Wiki article id");
const guidePages = new Set([
  "setup",
  "map",
  "schedule",
  "exams",
  "data",
  "displays",
  "overview",
  "students",
  "settings",
]);
const images = new Set();
for (const item of catalog) {
  assert.match(item.id, /^[a-z0-9-]+$/);
  assert.ok(
    item.title && item.summary && item.section && item.keywords.length,
    `${item.id}: missing metadata`,
  );
  assert.ok(guidePages.has(item.page), `${item.id}: invalid workspace page`);
  assert.match(item.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
  if (item.parentId) {
    const parent = catalog.find((parent) => parent.id === item.parentId);
    assert.ok(
      parent && parent.section === item.section,
      `${item.id}: invalid parent`,
    );
    const seen = new Set([item.id]);
    let ancestor = parent;
    while (ancestor) {
      assert.ok(!seen.has(ancestor.id), "Navigation cycle");
      seen.add(ancestor.id);
      ancestor = catalog.find((parent) => parent.id === ancestor.parentId);
    }
  }
  for (const id of item.related)
    assert.ok(ids.has(id), `${item.id}: unknown related article ${id}`);
  const markdown = await fs.readFile(
    path.join(directory, "articles", item.id + ".md"),
    "utf8",
  );
  assert.ok(markdown.length > 300, `${item.id}: article incomplete`);
  for (const link of markdown.matchAll(
    /\]\(\/wiki\/([a-z0-9-]+)(?:#[^)]*)?\)/g,
  ))
    assert.ok(ids.has(link[1]), `${item.id}: broken link ${link[1]}`);
  for (const image of markdown.matchAll(
    /!\[([^\]]*)\]\(\/api\/wiki\/assets\/([^)]*)\)/g,
  )) {
    assert.ok(image[1].trim(), "Image alt text missing");
    assert.ok(item.images.includes(image[2]), `${item.id}: unregistered image`);
  }
  for (const name of item.images) {
    assert.match(name, /^[a-z0-9-]+\.png$/);
    images.add(name);
    assert.ok(
      markdown.includes(`/api/wiki/assets/${name}`),
      `${item.id}: unused image ${name}`,
    );
    if (process.argv.includes("--check")) {
      const bytes = await fs.readFile(path.join(directory, "images", name));
      assert.equal(
        bytes.subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a",
        `${name}: invalid PNG`,
      );
    }
  }
}
const guides = catalog.map(({ id, title, keywords, page, summary }) => ({
  id,
  title,
  keywords,
  page,
  answer: summary,
}));
const expected = JSON.stringify(guides, null, 2) + "\n";
const target = path.join(root, "shared/campus-ai-knowledge.json");
if (process.argv.includes("--check"))
  assert.equal(
    await fs.readFile(target, "utf8"),
    expected,
    "Freddy knowledge stale: run npm run wiki:generate",
  );
else await fs.writeFile(target, expected);
console.log(
  `${catalog.length} articles, ${images.size} registered images, Freddy links valid`,
);
