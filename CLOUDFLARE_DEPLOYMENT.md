# Cloudflare Workers Deployment Guide

## Overview

This project is configured to deploy to **Cloudflare Workers** using the **@opennextjs/cloudflare** adapter (OpenNext). 

## Why OpenNext Instead of @cloudflare/next-on-pages?

While the initial requirement mentioned `@cloudflare/next-on-pages`, we use `@opennextjs/cloudflare` for the following reasons:

1. **@cloudflare/next-on-pages is officially deprecated** - Cloudflare recommends using the OpenNext adapter instead
2. **Version compatibility** - @cloudflare/next-on-pages only supports Next.js up to 15.5.2 (which has critical security vulnerabilities), while we use Next.js 15.5.12
3. **Architecture compatibility** - This codebase uses Node.js filesystem APIs extensively (for capsule management, markdown processing, etc.) which are not compatible with Edge runtime. OpenNext supports mixed runtime environments.
4. **Better performance** - OpenNext is actively maintained and provides better compatibility with Next.js features like ISR (Incremental Static Regeneration)

## Build Commands

### Full Build (Recommended for Cloudflare Dashboard)

**For Cloudflare Dashboard, use:**

```bash
npm run build && npx @opennextjs/cloudflare build
```

This command ensures:
1. The Next.js app is compiled (`npm run build` runs `next build`)
2. The build is converted to Cloudflare Worker format (`npx @opennextjs/cloudflare build`)
3. The output is placed in `.open-next/` directory required by the Worker

**Alternative:** If you need to include capsule generation and sitemap:

```bash
npm run build:cloudflare
```

This convenience script runs:
1. `npm run capsule:build` - Generates capsule pages from markdown
2. `npm run capsule:sitemap` - Generates sitemap.xml
3. `npx @opennextjs/cloudflare build` - Builds the Cloudflare Worker bundle

### Worker-Only Build

If capsules and sitemap are already built:

```bash
npm run build:worker
```

This command runs `npx @opennextjs/cloudflare build` which generates the `.open-next/` directory containing:
- `worker.js` - The Cloudflare Worker entry point
- `assets/` - Static assets to be served
- `server-functions/` - Serverless function bundles
- `cache/` - ISR cache configuration

## Deployment

### Manual Deployment

```bash
npm run deploy
```

This runs `npx @opennextjs/cloudflare deploy` which deploys to your configured Cloudflare account.

### Automated Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy-worker.yml`) that automatically:
1. Builds the project with `npm run build:worker`
2. Deploys to Cloudflare Workers with `npm run deploy --env production`
3. Includes retry logic for authentication issues

## Configuration Files

### wrangler.toml

Defines the Cloudflare Worker environment:
- **name**: `averyos-runtime`
- **main**: `.open-next/worker.js` - Worker entry point
- **assets**: `.open-next/assets` - Static asset directory
- **compatibility_flags**: `nodejs_compat` - Enables Node.js compatibility

### open-next.config.ts

Configures the OpenNext adapter with R2 incremental cache support for ISR features.

### next.config.js

- Disabled linting during builds to work around ESLint circular reference issues
- Linting can still be run manually with `npm run lint` for development
- Configured for trailing slashes and proper image domains
- No `output: 'export'` to preserve ISR functionality (revalidate)

## Edge Runtime Considerations

Some routes in this project cannot use Edge runtime because they require Node.js APIs:
- `/api/push` - Uses filesystem for VaultChain logging
- `/api/index` - Uses filesystem for file serving
- `/api/enforcement-log` - Uses filesystem for logging
- Other routes that use `lib/capsuleManifest.ts` and `lib/capsuleRegistry.ts`

The OpenNext adapter handles this correctly by bundling these as regular serverless functions while keeping static pages and other routes optimized.

## Cloudflare Pages Dashboard Configuration

When configuring your project in the Cloudflare Pages Dashboard:

**Build command:**
```bash
npm run build && npx @opennextjs/cloudflare build
```

This ensures the Next.js app is compiled into the `.open-next` format required by the Worker.

**Build output directory:**
```
.open-next
```

**Important:** Verify that the Build output directory is set to `.open-next` (not `out` or `.next`).

## Route-Specific Configuration

### /pay Route
The `/pay` page (AveryOS Licensing Terminal) is configured as a static page and works seamlessly with Cloudflare Workers.

### /index Route  
The index page uses `getStaticProps` with `revalidate: 60` for ISR, which is fully supported by OpenNext.

## Environment Variables

Required secrets (configured in GitHub Actions and wrangler.toml):
- `CLOUDFLARE_API_TOKEN` - For deployment
- `CLOUDFLARE_ACCOUNT_ID` - For deployment
- `VAULTSIG_SECRET` - For VaultChain operations
- `STRIPE_KEY` - For payment processing

## Local Development

For local development with the production worker:

```bash
npm run preview
```

This runs `npx @opennextjs/cloudflare preview` which starts a local Cloudflare Workers environment.

For standard Next.js development:

```bash
npm run dev
```

## Additional Resources

- [OpenNext Cloudflare Adapter Documentation](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/deploy-a-nextjs-site/)
