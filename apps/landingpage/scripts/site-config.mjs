export function createSiteConfig(env = {}, legal = {}) {
  const siteUrl = (env.SITE_URL || "").trim().replace(/\/$/, "");
  const contactEmail = (env.CONTACT_EMAIL || "").trim();
  const releaseValue = env.PUBLIC_RELEASE || "false";
  if (!["true", "false"].includes(releaseValue))
    throw new Error("PUBLIC_RELEASE muss true oder false sein.");
  if (siteUrl) {
    let url;
    try {
      url = new URL(siteUrl);
    } catch {
      throw new Error("SITE_URL muss eine gültige HTTPS-Domain sein.");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "SITE_URL muss eine HTTPS-Domain ohne Pfad, Zugangsdaten oder Parameter sein.",
      );
    }
  }
  if (
    contactEmail &&
    !/^[A-Za-z0-9.!#$%&'*+/=^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(
      contactEmail,
    )
  ) {
    throw new Error("CONTACT_EMAIL muss eine gültige E-Mail-Adresse sein.");
  }
  const hasSections = (sections) =>
    Array.isArray(sections) &&
    sections.length > 0 &&
    sections.every(
      (section) =>
        typeof section.heading === "string" &&
        section.heading.trim() &&
        Array.isArray(section.paragraphs) &&
        section.paragraphs.length > 0 &&
        section.paragraphs.every(
          (paragraph) => typeof paragraph === "string" && paragraph.trim(),
        ),
    );
  const legalReady =
    legal.approved === true &&
    hasSections(legal.imprint) &&
    hasSections(legal.privacy);
  const publicRelease = releaseValue === "true";
  if (publicRelease) {
    if (!siteUrl)
      throw new Error("SITE_URL fehlt für die öffentliche Freigabe.");
    if (!contactEmail)
      throw new Error("CONTACT_EMAIL fehlt für die öffentliche Freigabe.");
    if (!legalReady)
      throw new Error("Freigegebene, vollständige Rechtsinhalte fehlen.");
  }
  return {
    siteUrl,
    contactEmail,
    publicRelease,
    legalReady,
    demoUrl: "https://campustime-flame.vercel.app",
  };
}

export function shouldIgnoreBuild(branch) {
  return branch !== "landingpage";
}
