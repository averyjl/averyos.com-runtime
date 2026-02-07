const fs = require("fs");
const path = require("path");

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");
const outputDir = path.join(process.cwd(), "public");

const escapeXml = (value) => {
  if (!value) return "";
  return String(value)
/**
 * Escape XML entities to ensure valid XML output.
 */
const escapeXml = (str) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const normalizeSiteUrl = (value) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const escapeXml = (unsafe) => {
  if (typeof unsafe !== "string") {
    return String(unsafe);
  }
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const siteUrl =
  normalizeSiteUrl(process.env.SITE_URL) ||
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  "https://averyos.com";

const loadRegistry = () => {
  const registryPath = path.join(manifestDir, "index.json");
  if (!fs.existsSync(registryPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
};

const loadManifests = () => {
  if (!fs.existsSync(manifestDir)) {
    return [];
  }
  return fs
    .readdirSync(manifestDir)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "index.json")
    .map((fileName) => JSON.parse(fs.readFileSync(path.join(manifestDir, fileName), "utf8")));
};

const buildSitemapEntries = () => {
  const registry = loadRegistry();
  if (registry && Array.isArray(registry.capsules)) {
    return registry.capsules.map((capsule) => ({
      loc: `${siteUrl}/${capsule.capsuleId}`,
      lastmod: capsule.compiledAt || null,
    }));
  }

  return loadManifests().map((capsule) => ({
    loc: `${siteUrl}/${capsule.capsuleId}`,
    lastmod: capsule.compiledAt || null,
  }));
};

const buildSitemapXml = (entries) => {
  const urls = [
    {
      loc: siteUrl,
      lastmod: new Date().toISOString(),
    },
    ...entries,
  ];

  const urlTags = urls
    .map((entry) => {
      const escapedLoc = escapeXml(entry.loc);
      const lastmodTag = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<url><loc>${escapedLoc}</loc>${lastmodTag}</url>`;
      const lastmodTag = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmodTag}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}</urlset>`;
};

const buildRobotsTxt = () => {
  return `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
};

const writeOutputs = (sitemapXml, robotsTxt) => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, "sitemap.xml"), sitemapXml);
  fs.writeFileSync(path.join(outputDir, "robots.txt"), robotsTxt);
};

const main = () => {
  const entries = buildSitemapEntries();
  const sitemapXml = buildSitemapXml(entries);
  const robotsTxt = buildRobotsTxt();
  writeOutputs(sitemapXml, robotsTxt);
  console.log(`Wrote sitemap with ${entries.length + 1} URL(s).`);
};

main();
