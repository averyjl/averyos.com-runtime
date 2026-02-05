const fs = require("fs");
const path = require("path");

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");
const outputDir = path.join(process.cwd(), "public");
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
      const lastmodTag = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
      return `<url><loc>${entry.loc}</loc>${lastmodTag}</url>`;
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
const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://averyos.com";

const registryPath = path.join(__dirname, "..", "public", "capsule-registry");
const sitemapPath = path.join(__dirname, "..", "public", "sitemap.xml");

function generateSitemapEntry(capsuleId, sha) {
  return `
  <url>
    <loc>${siteUrl}/capsule/${capsuleId}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
}

function buildSitemap() {
  if (!fs.existsSync(registryPath)) {
    console.warn(`⚠️ No registry folder found at ${registryPath}`);
    return;
  }

  const files = fs.readdirSync(registryPath).filter(f => f.endsWith(".json"));

  const entries = files.map((file) => {
    const fullPath = path.join(registryPath, file);
    try {
      const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      return generateSitemapEntry(content.capsuleId, content.sha);
    } catch (err) {
      console.warn(`⚠️ Skipping malformed capsule: ${file}`);
      return null;
    }
  }).filter(Boolean);

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  fs.writeFileSync(sitemapPath, sitemapXml.trim());
  console.log(`✅ Sitemap written with ${entries.length} entries.`);
}

buildSitemap();
