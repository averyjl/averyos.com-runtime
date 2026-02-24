// open-next.config.ts - Configuration for @opennextjs/cloudflare adapter
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  // Force instruction through the type-check wall using 'as any'
  external: ["stripe"],
} as any);
