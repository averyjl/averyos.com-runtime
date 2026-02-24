// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  default: {
    minify: true,
    // This marks stripe as external to resolve the ESM worker bundling error
    external: ["stripe"],
  },
});
