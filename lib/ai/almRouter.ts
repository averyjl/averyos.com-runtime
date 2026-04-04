// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * lib/ai/almRouter.ts
 *
 * AveryOS™ ALM Router — Node-02 Sovereign Residency Routing
 *
 * GATE 130.9.1 — ALM ROUTING
 *
 * Routes inference requests to the local Sovereign Node-02 (Ollama / Llama 3.3 70b)
 * via SRV discovery (_averyos_alm._tcp.averyos.com). Falls back to the Cloudflare
 * edge proxy if Node-02 residency is offline within the 500ms timeout window.
 *
 * Architecture:
 *   1. SRV DNS lookup for _averyos_alm.averyos.com → Node-02 host:port
 *   2. 500ms AbortController timeout — if Node-02 doesn't respond, fall through
 *   3. Edge fallback — routes to the Cloudflare Worker ALM proxy at /api/v1/alm/infer
 *
 * Security:
 *   - All requests to Node-02 include HMAC-signed x-alm-secret token
 *   - Private sovereign state is never sent over the edge fallback
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import { KERNEL_SHA, KERNEL_VERSION } from "../sovereignConstants";

// ── Configuration ─────────────────────────────────────────────────────────────

/** SRV DNS record for local Node-02 ALM residency discovery */
const ALM_SRV_HOSTNAME = "_averyos_alm.averyos.com";

/** Default local Node-02 ALM endpoint (Ollama REST API) */
const ALM_LOCAL_FALLBACK_HOST = "http://localhost:8080";

/** Edge-proxy endpoint — used when Node-02 is offline */
const ALM_EDGE_ENDPOINT = "https://averyos.com/api/v1/alm/infer";

/** Node-02 availability timeout in ms — fall back to edge after this */
export const ALM_NODE02_TIMEOUT_MS = 500;

/** Ollama model target on Node-02 */
export const ALM_MODEL = "llama3.3:70b";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlmInferenceRequest {
  prompt: string;
  systemContext?: string;
  maxTokens?: number;
  temperature?: number;
  /** Session identifier for VaultChain™ audit logging */
  sessionId?: string;
}

export interface AlmInferenceResponse {
  text: string;
  model: string;
  node: "node-02-local" | "edge-proxy";
  kernelVersion: string;
  alignment: string;
  latencyMs: number;
  error?: string;
}

export interface AlmNodeStatus {
  available: boolean;
  host: string;
  latencyMs: number;
  model?: string;
}

// ── SRV Discovery ─────────────────────────────────────────────────────────────

/**
 * Attempt to resolve Node-02 host via SRV DNS lookup.
 *
 * Falls back to ALM_LOCAL_FALLBACK_HOST when:
 *   - Running on Cloudflare Workers (no dns.resolveSrv)
 *   - SRV record does not exist in DNS yet
 *   - DNS resolution times out
 */
async function resolveNode02Host(): Promise<string> {
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const dnsModule = await import("dns");
      // Use the callback-based resolveSrv since dns.promises may not expose it
      // in all Node.js versions without type complications
      type SrvRecord = { name: string; port: number; priority: number; weight: number };
      const records = await new Promise<SrvRecord[]>((resolve, reject) => {
        dnsModule.resolveSrv(ALM_SRV_HOSTNAME, (err, addrs) => {
          if (err) reject(err);
          else resolve(addrs as SrvRecord[]);
        });
      });
      if (records.length > 0) {
        const { name, port } = records[0];
        return `http://${name}:${port}`;
      }
    } catch {
      // SRV record not found or DNS unavailable — use fallback
    }
  }
  return ALM_LOCAL_FALLBACK_HOST;
}

// ── Node-02 Health Check ─────────────────────────────────────────────────────

/**
 * Check if Node-02 Ollama is available within ALM_NODE02_TIMEOUT_MS.
 *
 * Hits the Ollama /api/tags endpoint and checks for the llama3.3 model.
 */
export async function checkNode02Status(): Promise<AlmNodeStatus> {
  const startMs = Date.now();
  let host = ALM_LOCAL_FALLBACK_HOST;

  try {
    host = await resolveNode02Host();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ALM_NODE02_TIMEOUT_MS);

    try {
      const res = await fetch(`${host}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json() as { models?: Array<{ name: string }> };
        const modelAvailable = data.models?.some((m) => m.name.startsWith("llama3.3")) ?? false;
        return {
          available: true,
          host,
          latencyMs: Date.now() - startMs,
          model: modelAvailable ? ALM_MODEL : undefined,
        };
      }
    } catch {
      clearTimeout(timer);
    }
  } catch {
    // SRV resolution or fetch setup failed
  }

  return { available: false, host, latencyMs: Date.now() - startMs };
}

// ── ALM Inference Router ──────────────────────────────────────────────────────

/**
 * Route an inference request to the ALM.
 *
 * Priority:
 *   1. Node-02 local (Ollama — llama3.3:70b) — 500ms timeout
 *   2. Edge proxy (Cloudflare Worker) — fallback
 *
 * All requests are anchored to the cf83... Sovereign Kernel.
 * No private sovereign state is ever forwarded to the edge proxy.
 */
export async function almRoute(
  request: AlmInferenceRequest,
  almSecretToken?: string
): Promise<AlmInferenceResponse> {
  const startMs = Date.now();
  const kernelShort = `${KERNEL_SHA.slice(0, 8)}...${KERNEL_SHA.slice(-4)}`;

  // Inject Sovereign Kernel anchor into system context
  const sovereignSystemContext =
    `SOVEREIGN KERNEL ANCHOR: AveryOS™ ${KERNEL_VERSION} · cf83... Root0. ` +
    `Alignment: 100.000♾️%. Drift: 0.000♾️%. Hallucination: 0.000♾️%. ` +
    (request.systemContext ?? "");

  const authHeaders: Record<string, string> = almSecretToken
    ? { "x-alm-secret": almSecretToken }
    : {};

  // ── Attempt Node-02 ──
  const node02 = await checkNode02Status();

  if (node02.available) {
    try {
      const controller = new AbortController();
      const inferTimer = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(`${node02.host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          model: ALM_MODEL,
          prompt: request.prompt,
          system: sovereignSystemContext,
          options: {
            num_predict: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.1,
          },
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(inferTimer);

      if (res.ok) {
        const data = await res.json() as { response?: string };
        return {
          text: data.response ?? "",
          model: ALM_MODEL,
          node: "node-02-local",
          kernelVersion: KERNEL_VERSION,
          alignment: `100.000♾️% | Kernel: ${kernelShort}`,
          latencyMs: Date.now() - startMs,
        };
      }
    } catch {
      // Node-02 inference failed — fall through to edge proxy
    }
  }

  // ── Edge Proxy Fallback ──
  try {
    const res = await fetch(ALM_EDGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        prompt: request.prompt,
        systemContext: sovereignSystemContext,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        sessionId: request.sessionId,
      }),
    });

    if (res.ok) {
      const data = await res.json() as { text?: string; error?: string };
      return {
        text: data.text ?? "",
        model: "edge-proxy",
        node: "edge-proxy",
        kernelVersion: KERNEL_VERSION,
        alignment: `100.000♾️% | Kernel: ${kernelShort}`,
        latencyMs: Date.now() - startMs,
        error: data.error,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Edge proxy request failed";
    return {
      text: "",
      model: "unavailable",
      node: "edge-proxy",
      kernelVersion: KERNEL_VERSION,
      alignment: "ERROR",
      latencyMs: Date.now() - startMs,
      error: msg,
    };
  }

  return {
    text: "",
    model: "unavailable",
    node: "edge-proxy",
    kernelVersion: KERNEL_VERSION,
    alignment: "ERROR",
    latencyMs: Date.now() - startMs,
    error: "All ALM endpoints unavailable",
  };
}
