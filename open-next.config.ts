// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  // Removed 'minify' to resolve Type Error in CloudflareOverrides
  // Externalizing stripe remains the priority to bypass bundling friction
  external: ["stripe"],
});
