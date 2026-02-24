// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  minify: true,
  // Externalizing stripe resolves the ESM worker bundling error
  external: ["stripe"],
});
