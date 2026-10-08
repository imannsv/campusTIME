import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const build = path.resolve(root, process.argv[2] || "dist");
async function files(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      ),
    )
  ).flat();
}
const artifacts = await files(build);
const catalog = JSON.parse(
  await fs.readFile(path.join(root, "shared/wiki/catalog.json"), "utf8"),
);
const imageNames = new Set(catalog.flatMap((item) => item.images));
const privateTexts = [];
for (const item of catalog) {
  const body = await fs.readFile(
    path.join(root, `shared/wiki/articles/${item.id}.md`),
    "utf8",
  );
  const paragraph = body
    .split(/\r?\n/)
    .find(
      (text) =>
        text.length > 80 &&
        !text.startsWith("!") &&
        !text.startsWith("#") &&
        !catalog.some((guide) => guide.summary.includes(text)),
    );
  assert.ok(paragraph, `${item.id}: distinctive full article text missing`);
  privateTexts.push(paragraph);
}
for (const file of artifacts) {
  assert.ok(
    !imageNames.has(path.basename(file)),
    `${file}: protected image in static build`,
  );
  assert.ok(
    !file.includes("shared/wiki"),
    `${file}: protected directory in static build`,
  );
  if (/\.(js|html|json|map)$/.test(file)) {
    const text = await fs.readFile(file, "utf8");
    for (const privateText of privateTexts)
      assert.ok(
        !text.includes(privateText) &&
          !text.includes(JSON.stringify(privateText).slice(1, -1)),
        `${file}: full Wiki article in static build`,
      );
    for (const name of imageNames)
      assert.ok(
        !text.includes(`/api/wiki/assets/${name}`),
        `${file}: protected illustration embedded`,
      );
  }
}
console.log(
  "Static demo: no complete Wiki articles or protected images included.",
);
