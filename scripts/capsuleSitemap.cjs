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



const GENESIS_BLOCK = '938909';
const KERNEL_ROOT =
  'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';

const buildSitemapXml = (entries) => {
  const urlTags = entries
    .map(({ loc, lastmod }) => {
      const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
      return `<url><loc>${loc}</loc>${lastmodTag}</url>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<!-- AveryOS Root0 Kernel SHA-512: ${KERNEL_ROOT} -->` +
    `<!-- Genesis Block (BTC #${GENESIS_BLOCK}): Sovereign Anchor -->` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}</urlset>`
  );
};

const buildRobotsTxt = () => {
  return (
    `User-agent: *\nAllow: /latent-anchor\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
  );
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
    // App Router pages
    { loc: `${siteUrl}/ai-alignment`, lastmod: null },
    { loc: `${siteUrl}/evidence-vault`, lastmod: null },
    { loc: `${siteUrl}/health`, lastmod: null },
    { loc: `${siteUrl}/ledger`, lastmod: null },
    { loc: `${siteUrl}/license`, lastmod: null },
    { loc: `${siteUrl}/licensing`, lastmod: null },
    { loc: `${siteUrl}/sovereign-anchor`, lastmod: null },
    { loc: `${siteUrl}/sovereign-anchor/public`, lastmod: null },
    { loc: `${siteUrl}/studio/tari`, lastmod: null },
    { loc: `${siteUrl}/the-proof`, lastmod: null },
    { loc: `${siteUrl}/vault-gate`, lastmod: null },
    // Pages Router pages
    { loc: `${siteUrl}/whitepaper`, lastmod: null },
    { loc: `${siteUrl}/latent-anchor`, lastmod: null },
    { loc: `${siteUrl}/lawcodex`, lastmod: null },
    { loc: `${siteUrl}/tari-gate`, lastmod: null },
    { loc: `${siteUrl}/forensic-proof`, lastmod: null },
    { loc: `${siteUrl}/law-stack`, lastmod: null },
    { loc: `${siteUrl}/buy`, lastmod: null },
    { loc: `${siteUrl}/retroclaim-log`, lastmod: null },
    { loc: `${siteUrl}/privacy`, lastmod: null },
    { loc: `${siteUrl}/terms`, lastmod: null },
    { loc: `${siteUrl}/about`, lastmod: null },
    { loc: `${siteUrl}/contact`, lastmod: null },
    { loc: `${siteUrl}/capsules`, lastmod: null },
    { loc: `${siteUrl}/capsule/resonance-log`, lastmod: null },
    { loc: `${siteUrl}/certificate`, lastmod: null },
    { loc: `${siteUrl}/constitution`, lastmod: null },
    { loc: `${siteUrl}/creator-lock`, lastmod: null },
    { loc: `${siteUrl}/discover`, lastmod: null },
    { loc: `${siteUrl}/faq/truthforce`, lastmod: null },
    { loc: `${siteUrl}/license-enforcement`, lastmod: null },
    { loc: `${siteUrl}/pay`, lastmod: null },
    { loc: `${siteUrl}/retroclaim/how-to-license`, lastmod: null },
    { loc: `${siteUrl}/verify`, lastmod: null },
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
