/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
const fs = require("fs");
const path = require("path");
const { sovereignWriteSync, PUBLIC_ROOT } = require("./lib/sovereignIO.cjs");

const manifestDir = path.join(process.cwd(), "public", "manifest", "capsules");
const registryPath = path.join(process.cwd(), "public", "capsule-registry");
const appDir = path.join(process.cwd(), "app");
const pagesDir = path.join(process.cwd(), "pages");

// Valid page file names for the App Router (Next.js convention)
const APP_PAGE_FILES = new Set(["page.tsx", "page.ts", "page.jsx", "page.js"]);
// Valid source file extensions for the Pages Router
const PAGES_EXTENSIONS = new Set([".tsx", ".ts", ".js", ".jsx"]);
// Strip file extension helper
const stripExt = (name) => name.replace(/\.[^.]+$/, "");

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

// Paths that are redirect sources — excluded from sitemap (canonical is the target)
const REDIRECT_SOURCES = new Set([
  '/start',
  '/pay',
  '/buy',
  '/law-stack',
  '/forensic-proof',
  '/retroclaim-log',
  '/license-enforcement',
]);

// Paths to explicitly exclude (API, private, dynamic params, internals)
const EXCLUDE_PREFIXES = ['/api/', '/_'];
const EXCLUDE_EXACT = new Set(['/health']);

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
    `User-agent: *\nAllow: /whitepaper\nAllow: /latent-anchor\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
  );
};

const writeOutputs = (sitemapXml) => {
  sovereignWriteSync(PUBLIC_ROOT, "sitemap.xml", sitemapXml);
  // NOTE: public/robots.txt is intentionally NOT written here.
  // app/robots.ts handles dynamic per-subdomain robots.txt via the Next.js
  // Metadata API. Writing a static public/robots.txt would shadow the dynamic
  // handler in Cloudflare Workers (ASSETS binding takes priority), causing the
  // LLM-scraper blocking rules to be silently bypassed.
};

// Returns true if the path segment is a dynamic Next.js route like [param] or [...slug]
const isDynamic = (segment) => segment.startsWith("[");

// Auto-scan the App Router (app/) directory for page.tsx files
const scanAppRouter = () => {
  const urls = [];
  if (!fs.existsSync(appDir)) return urls;

  const walk = (dir, urlPath) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let hasPage = false;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const seg = entry.name;
        // Skip API, private dirs, and dynamic route segments
        if (seg === "api" || seg.startsWith("_") || isDynamic(seg)) continue;
        walk(path.join(dir, seg), `${urlPath}/${seg}`);
      } else if (APP_PAGE_FILES.has(entry.name)) {
        hasPage = true;
      }
    }

    if (hasPage && urlPath !== "") {
      urls.push(urlPath);
    }
  };

  walk(appDir, "");
  return urls;
};

// Auto-scan the Pages Router (pages/) directory for .tsx/.ts/.js/.jsx files
const scanPagesRouter = () => {
  const urls = [];
  if (!fs.existsSync(pagesDir)) return urls;

  const walk = (dir, urlPath) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const seg = entry.name;
        // Skip API, private dirs, and dynamic route segments
        if (seg === "api" || seg.startsWith("_") || isDynamic(seg)) continue;
        walk(path.join(dir, seg), `${urlPath}/${seg}`);
      } else {
        const name = entry.name;
        // Skip migrated, private, dynamic, and non-page files
        if (name.includes(".migrated")) continue;
        if (name.startsWith("_")) continue;

        const ext = path.extname(name);
        if (!PAGES_EXTENSIONS.has(ext)) continue;

        const slug = stripExt(name);
        if (isDynamic(slug)) continue;

        const fullPath = slug === "index" ? urlPath || "/" : `${urlPath}/${slug}`;

        // Skip index of root (that's the homepage, handled separately)
        if (fullPath === "/") continue;

        urls.push(fullPath);
      }
    }
  };

  walk(pagesDir, "");
  return urls;
};

// Deduplicate and filter a list of URL paths, return as sitemap entries
const toSitemapEntries = (paths) => {
  const seen = new Set();
  return paths
    .filter((p) => {
      if (REDIRECT_SOURCES.has(p)) return false;
      if (EXCLUDE_EXACT.has(p)) return false;
      if (EXCLUDE_PREFIXES.some((prefix) => p.startsWith(prefix))) return false;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    })
    .map((p) => ({ loc: `${siteUrl}${p}`, lastmod: null }));
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
  const appPaths = scanAppRouter();
  const pagesPaths = scanPagesRouter();

  // Combine all scanned paths, deduplicate, filter
  const allPaths = [...appPaths, ...pagesPaths];
  const scannedEntries = toSitemapEntries(allPaths);

  const registry = loadRegistryCapsules();
  const manifest = loadManifestCapsules();

  // Deduplicate against scanned entries using a Set of loc values
  const scannedLocs = new Set(scannedEntries.map((e) => e.loc));
  const uniqueRegistry = registry.filter((e) => !scannedLocs.has(e.loc));
  const uniqueManifest = manifest.filter((e) => !scannedLocs.has(e.loc));

  const entries = [
    { loc: siteUrl, lastmod: new Date().toISOString() },
    ...scannedEntries,
    ...uniqueRegistry,
    ...uniqueManifest,
  ];

  const sitemapXml = buildSitemapXml(entries);

  writeOutputs(sitemapXml);
  console.log(`✅ Wrote sitemap with ${entries.length} URL(s) (${appPaths.length} app-router, ${pagesPaths.length} pages-router scanned)`);
};

main();

