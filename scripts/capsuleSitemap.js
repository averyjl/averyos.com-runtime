const fs = require("fs");
const path = require("path");

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");
const registryPath = path.join(process.cwd(), "public", "capsule-registry");
const outputDir = path.join(process.cwd(), "public");

const normalizeSiteUrl = (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const siteUrl =
  normalizeSiteUrl(process.env.SITE_URL) ||
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  "https://averyos.com";



const buildSitemapXml = (entries) => {
  const urlTags = entries
    .map(({ loc, lastmod }) => {
      const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
      return `<url><loc>${loc}</loc>${lastmodTag}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}</urlset>`;
};

const buildRobotsTxt = () => {
  return `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
};

const writeOutputs = (sitemapXml, robotsTxt) => {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "sitemap.xml"), sitemapXml);
  fs.writeFileSync(path.join(outputDir, "robots.txt"), robotsTxt);
};

// Load manifest-based capsules (optional legacy support)
const loadManifestCapsules = () => {
  if (!fs.existsSync(manifestDir)) return [];
  return fs
    .readdirSync(manifestDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(manifestDir, f), "utf8")))
    .map((capsule) => ({
      loc: `${siteUrl}/${capsule.capsuleId}`,
      lastmod: capsule.compiledAt || null,
    }));
};

// Load registry-based capsules
const loadRegistryCapsules = () => {
  if (!fs.existsSync(registryPath)) return [];
  return fs
    .readdirSync(registryPath)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const slug = f.replace(".json", "");
      return {
        loc: `${siteUrl}/capsule/${slug}`,
        lastmod: null,
      };
    });
};

const main = () => {
  const staticUrls = [
    { loc: `${siteUrl}/license`, lastmod: null },
    { loc: `${siteUrl}/buy`, lastmod: null },
    { loc: `${siteUrl}/retroclaim-log`, lastmod: null },
    { loc: `${siteUrl}/privacy`, lastmod: null },
    { loc: `${siteUrl}/terms`, lastmod: null },
    { loc: `${siteUrl}/about`, lastmod: null },
    { loc: `${siteUrl}/contact`, lastmod: null },
  ];

  const registry = loadRegistryCapsules();
  const manifest = loadManifestCapsules();

  const entries = [
    { loc: siteUrl, lastmod: new Date().toISOString() },
    ...registry,
    ...manifest,
    ...staticUrls,
  ];

  const sitemapXml = buildSitemapXml(entries);
  const robotsTxt = buildRobotsTxt();

  writeOutputs(sitemapXml, robotsTxt);
  console.log(`✅ Wrote sitemap with ${entries.length} URL(s)`);
};

main();
