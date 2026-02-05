const fs = require("fs");
const path = require("path");

const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://averyos.com";

// Read all capsule manifest files from the capsule registry
const registryPath = path.join(__dirname, "..", "public", "capsule-registry");
const files = fs.readdirSync(registryPath);

const urls = files
  .filter((file) => file.endsWith(".json"))
  .map((file) => {
    const slug = file.replace(".json", "");
    return `${siteUrl}/capsule/${slug}`;
  });

// Add root paths
urls.push(`${siteUrl}/license`);
urls.push(`${siteUrl}/buy`);
urls.push(`${siteUrl}/retroclaim-log`);

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `
  <url>
    <loc>${url}</loc>
  </url>`
  )
  .join("")}
</urlset>`;

fs.writeFileSync(path.join(__dirname, "..", "public", "sitemap.xml"), sitemapXml);

console.log(`✅ Wrote sitemap with ${urls.length} URL(s)`);
