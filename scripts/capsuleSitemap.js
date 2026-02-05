const fs = require("fs");
const path = require("path");

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
