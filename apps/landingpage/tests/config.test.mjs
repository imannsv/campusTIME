import { test } from "node:test";
import assert from "node:assert/strict";

const module = await import("../scripts/site-config.mjs").catch(() => ({}));
const legal = {
  approved: true,
  imprint: [
    {
      heading: "Anbieter",
      paragraphs: ["Fiktiver Testanbieter für den Konfigurationstest."],
    },
  ],
  privacy: [
    {
      heading: "Datenschutz",
      paragraphs: ["Fiktiver Testtext für den Konfigurationstest."],
    },
  ],
};

test("unconfigured builds are explicitly non-public without fabricated URLs or contact", () => {
  assert.equal(
    typeof module.createSiteConfig,
    "function",
    "site configuration is not implemented",
  );
  const config = module.createSiteConfig(
    {},
    { approved: false, imprint: [], privacy: [] },
  );
  assert.equal(config.publicRelease, false);
  assert.equal(config.siteUrl, "");
  assert.equal(config.contactEmail, "");
  assert.equal(config.demoUrl, "https://campustime-flame.vercel.app");
});

test("public release rejects missing identity, contact or canonical origin", () => {
  assert.equal(
    typeof module.createSiteConfig,
    "function",
    "site configuration is not implemented",
  );
  assert.throws(
    () => module.createSiteConfig({ PUBLIC_RELEASE: "true" }, legal),
    /SITE_URL/,
  );
  assert.throws(
    () =>
      module.createSiteConfig(
        { PUBLIC_RELEASE: "true", SITE_URL: "https://campuszeit.example" },
        legal,
      ),
    /CONTACT_EMAIL/,
  );
  assert.throws(
    () =>
      module.createSiteConfig(
        {
          PUBLIC_RELEASE: "true",
          SITE_URL: "https://campuszeit.example",
          CONTACT_EMAIL: "kontakt@example.org",
        },
        { ...legal, approved: false },
      ),
    /Rechtsinhalte/,
  );
  assert.throws(
    () =>
      module.createSiteConfig(
        {
          PUBLIC_RELEASE: "true",
          SITE_URL: "https://campuszeit.example",
          CONTACT_EMAIL: "kontakt@example.org",
        },
        { ...legal, privacy: [] },
      ),
    /Rechtsinhalte/,
  );
});

test("configured release normalizes its origin and requires real approved text", () => {
  assert.equal(
    typeof module.createSiteConfig,
    "function",
    "site configuration is not implemented",
  );
  const config = module.createSiteConfig(
    {
      PUBLIC_RELEASE: "true",
      SITE_URL: "https://campuszeit.example/",
      CONTACT_EMAIL: "kontakt@example.org",
    },
    legal,
  );
  assert.equal(config.siteUrl, "https://campuszeit.example");
  assert.equal(config.contactEmail, "kontakt@example.org");
  assert.equal(config.publicRelease, true);
});

test("configuration rejects unsafe URL, email and ambiguous release inputs", () => {
  assert.equal(
    typeof module.createSiteConfig,
    "function",
    "site configuration is not implemented",
  );
  for (const siteUrl of [
    "javascript:alert(1)",
    "https://user:pass@example.org",
    "https://example.org/path",
    "http://example.org",
    "https://example.org/?x=1",
  ]) {
    assert.throws(
      () => module.createSiteConfig({ SITE_URL: siteUrl }, legal),
      /SITE_URL/,
    );
  }
  for (const email of [
    "no-address",
    "x@example.org\r\nBcc:other@example.org",
    "x@example.org?subject=bad",
  ]) {
    assert.throws(
      () => module.createSiteConfig({ CONTACT_EMAIL: email }, legal),
      /CONTACT_EMAIL/,
    );
  }
  assert.throws(
    () => module.createSiteConfig({ PUBLIC_RELEASE: "yes" }, legal),
    /PUBLIC_RELEASE/,
  );
});

test("only the landingpage branch is permitted by the ignored build step", () => {
  assert.equal(
    typeof module.shouldIgnoreBuild,
    "function",
    "branch filter is not implemented",
  );
  assert.equal(module.shouldIgnoreBuild("landingpage"), false);
  for (const branch of ["main", "feature/new", "", undefined])
    assert.equal(module.shouldIgnoreBuild(branch), true);
});

test("unresolved legal placeholders cannot be approved for public release", () => {
  const env = {
    PUBLIC_RELEASE: "true",
    SITE_URL: "https://campuszeit.example",
    CONTACT_EMAIL: "kontakt@example.org",
  };
  for (const field of ["imprint", "privacy"]) {
    const incomplete = {
      ...legal,
      [field]: [{ heading: "Anbieter", paragraphs: ["[VOLLSTÄNDIGER NAME]"] }],
    };
    assert.equal(module.createSiteConfig({}, incomplete).legalReady, false);
    assert.throws(
      () => module.createSiteConfig(env, incomplete),
      /Rechtsinhalte/,
    );
  }
  const unfinishedHeading = {
    ...legal,
    imprint: [{ heading: "[ANBIETER]", paragraphs: ["Bestätigte Angaben."] }],
  };
  assert.throws(
    () => module.createSiteConfig(env, unfinishedHeading),
    /Rechtsinhalte/,
  );
});
