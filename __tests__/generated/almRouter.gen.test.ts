/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * Real functional tests for lib/ai/almRouter.ts
 *
 * Tests the ALM (AveryOS™ Language Model) router which handles:
 * - Node-02 health checks with timeout handling
 * - Inference routing (Node-02 local → Edge proxy fallback)
 * - SSRF protection and HMAC token authentication
 * - Sovereign kernel anchor injection
 */

import { strict as assert } from "node:assert";
import { describe, test, mock } from "node:test";
import {
  ALM_NODE02_TIMEOUT_MS,
  ALM_MODEL,
  checkNode02Status,
  almRoute,
  type AlmInferenceRequest,
} from "../../lib/ai/almRouter";

describe("lib/ai/almRouter.ts", () => {
  test("ALM_NODE02_TIMEOUT_MS constant is exported and is 500ms", () => {
    assert.strictEqual(typeof ALM_NODE02_TIMEOUT_MS, "number");
    assert.strictEqual(ALM_NODE02_TIMEOUT_MS, 500);
  });

  test("ALM_MODEL constant is exported and is llama3.3:70b", () => {
    assert.strictEqual(typeof ALM_MODEL, "string");
    assert.strictEqual(ALM_MODEL, "llama3.3:70b");
  });

  describe("checkNode02Status()", () => {
    test("returns available=true when Node-02 responds with llama3.3 model", async () => {
      // Mock successful Ollama /api/tags response
      const mockFetch = mock.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: "llama3.3:70b" }],
          }),
        };
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const status = await checkNode02Status();

      assert.strictEqual(status.available, true);
      assert.strictEqual(status.model, ALM_MODEL);
      assert.ok(status.latencyMs >= 0);
      assert.ok(status.host.startsWith("http://"));
    });

    test("returns available=true but no model when llama3.3 not found", async () => {
      const mockFetch = mock.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            models: [{ name: "llama2:7b" }],
          }),
        };
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const status = await checkNode02Status();

      assert.strictEqual(status.available, true);
      assert.strictEqual(status.model, undefined);
    });

    test("returns available=false when Node-02 times out", async () => {
      const mockFetch = mock.fn(async () => {
        // Simulate timeout by delaying longer than ALM_NODE02_TIMEOUT_MS
        await new Promise((resolve) => setTimeout(resolve, ALM_NODE02_TIMEOUT_MS + 100));
        throw new Error("Timeout");
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const status = await checkNode02Status();

      assert.strictEqual(status.available, false);
      assert.ok(status.latencyMs >= ALM_NODE02_TIMEOUT_MS);
    });

    test("returns available=false when Node-02 returns error status", async () => {
      const mockFetch = mock.fn(async () => {
        return {
          ok: false,
          status: 500,
        };
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const status = await checkNode02Status();

      assert.strictEqual(status.available, false);
    });

    test("returns available=false when fetch throws network error", async () => {
      const mockFetch = mock.fn(async () => {
        throw new Error("ECONNREFUSED");
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const status = await checkNode02Status();

      assert.strictEqual(status.available, false);
    });
  });

  describe("almRoute()", () => {
    test("routes to Node-02 when available and returns successful inference", async () => {
      let fetchCallCount = 0;
      const mockFetch = mock.fn(async (url: string) => {
        fetchCallCount++;

        // First call: /api/tags health check
        if (url.toString().includes("/api/tags")) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: "llama3.3:70b" }] }),
          };
        }

        // Second call: /api/generate inference
        if (url.toString().includes("/api/generate")) {
          return {
            ok: true,
            json: async () => ({ response: "This is the ALM inference response." }),
          };
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "What is AveryOS?",
        systemContext: "You are a sovereign AI assistant.",
        maxTokens: 1024,
        temperature: 0.1,
      };

      const response = await almRoute(request, "test-secret-token");

      assert.strictEqual(response.node, "node-02-local");
      assert.strictEqual(response.model, ALM_MODEL);
      assert.ok(response.text.length > 0);
      assert.ok(response.alignment.includes("100.000♾️%"));
      assert.ok(response.alignment.includes("cf83"));
      assert.ok(response.latencyMs >= 0);
      assert.strictEqual(fetchCallCount, 2);
    });

    test("falls back to edge proxy when Node-02 is unavailable", async () => {
      let fetchCallCount = 0;
      const mockFetch = mock.fn(async (url: string) => {
        fetchCallCount++;

        // First call: /api/tags health check — simulate Node-02 offline
        if (url.toString().includes("/api/tags")) {
          throw new Error("ECONNREFUSED");
        }

        // Second call: edge proxy at /api/v1/alm/infer
        if (url.toString().includes("/api/v1/alm/infer")) {
          return {
            ok: true,
            json: async () => ({ text: "Edge proxy response" }),
          };
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "What is VaultChain?",
      };

      const response = await almRoute(request);

      assert.strictEqual(response.node, "edge-proxy");
      assert.strictEqual(response.text, "Edge proxy response");
      assert.ok(response.alignment.includes("100.000♾️%"));
      assert.strictEqual(fetchCallCount, 2);
    });

    test("returns error when Node-02 fails inference and edge also fails", async () => {
      const mockFetch = mock.fn(async (url: string) => {
        // Health check succeeds
        if (url.toString().includes("/api/tags")) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: "llama3.3:70b" }] }),
          };
        }

        // Both inference endpoints fail
        throw new Error("Network failure");
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "Test prompt",
      };

      const response = await almRoute(request);

      assert.strictEqual(response.node, "edge-proxy");
      assert.ok(response.error);
      assert.strictEqual(response.alignment, "ERROR");
    });

    test("injects sovereign kernel anchor into system context", async () => {
      let capturedSystemContext = "";
      const mockFetch = mock.fn(async (url: string, options?: RequestInit) => {
        if (url.toString().includes("/api/tags")) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: "llama3.3:70b" }] }),
          };
        }

        if (url.toString().includes("/api/generate")) {
          const body = JSON.parse(options?.body as string);
          capturedSystemContext = body.system || "";
          return {
            ok: true,
            json: async () => ({ response: "Test response" }),
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "Test",
        systemContext: "Custom context",
      };

      await almRoute(request);

      assert.ok(capturedSystemContext.includes("SOVEREIGN KERNEL ANCHOR"));
      assert.ok(capturedSystemContext.includes("AveryOS™"));
      assert.ok(capturedSystemContext.includes("cf83..."));
      assert.ok(capturedSystemContext.includes("100.000♾️%"));
      assert.ok(capturedSystemContext.includes("Drift: 0.000♾️%"));
      assert.ok(capturedSystemContext.includes("Hallucination: 0.000♾️%"));
      assert.ok(capturedSystemContext.includes("Custom context"));
    });

    test("includes HMAC token in request headers when provided", async () => {
      let capturedHeaders: Record<string, string> = {};
      const mockFetch = mock.fn(async (url: string, options?: RequestInit) => {
        if (url.toString().includes("/api/tags")) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: "llama3.3:70b" }] }),
          };
        }

        if (url.toString().includes("/api/generate")) {
          capturedHeaders = (options?.headers || {}) as Record<string, string>;
          return {
            ok: true,
            json: async () => ({ response: "Test" }),
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "Test",
      };

      await almRoute(request, "test-hmac-token-123");

      assert.strictEqual(capturedHeaders["x-alm-secret"], "test-hmac-token-123");
    });

    test("returns unavailable when all endpoints fail", async () => {
      const mockFetch = mock.fn(async () => {
        throw new Error("All endpoints offline");
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const request: AlmInferenceRequest = {
        prompt: "Test",
      };

      const response = await almRoute(request);

      assert.strictEqual(response.model, "unavailable");
      assert.strictEqual(response.text, "");
      assert.strictEqual(response.alignment, "ERROR");
      assert.ok(response.error);
      // The error message comes from the caught exception
      assert.strictEqual(response.error, "All endpoints offline");
    });
  });
});
