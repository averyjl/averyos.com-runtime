/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KERNEL_SHA } from "../../../../lib/sovereignConstants";
import { settleRetroactiveLiability, type D1Database } from "../../../../lib/retroactiveLedger";
import { formatIso9 } from "../../../../lib/timePrecision";

interface CloudflareEnv {
  DB: D1Database;
  GITHUB_PAT?: string;
  GITHUB_REPO_OWNER?: string;
  GITHUB_REPO_NAME?: string;
  GITHUB_REGISTRY_PATH?: string;
}

type SettlementRequest = {
  entity_id?: string;
  settlement_token?: string;
  signed_agreement?: string;
  kernel_hash?: string;
};

async function appendSettlementRegistry(
  env: CloudflareEnv,
  line: string,
): Promise<void> {
  if (!env.GITHUB_PAT || !env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME) {
    return;
  }

  const path = env.GITHUB_REGISTRY_PATH || "vaultchain-registry/settlements.log";
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${encodedPath}`;

  let currentContent = "";
  let sha: string | undefined;

  const getRes = await fetch(baseUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (getRes.ok) {
    const existing = await getRes.json() as { content?: string; sha?: string };
    sha = existing.sha;
    if (existing.content) {
      currentContent = Buffer.from(existing.content.replace(/\n/g, ""), "base64").toString("utf8");
    }
  }

  const updatedContent = `${currentContent}${currentContent.endsWith("\n") || currentContent.length === 0 ? "" : "\n"}${line}\n`;
  const putBody: {
    message: string;
    content: string;
    sha?: string;
  } = {
    message: `chore: append settlement event for ${line.split("|")[1]?.trim() || "entity"}`,
    content: Buffer.from(updatedContent, "utf8").toString("base64"),
  };

  if (sha) {
    putBody.sha = sha;
  }

  await fetch(baseUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(putBody),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SettlementRequest;

    const entityId = typeof body.entity_id === "string" ? body.entity_id.trim() : "";
    const signedAgreement =
      typeof body.signed_agreement === "string" ? body.signed_agreement : "";
    const kernelHash = typeof body.kernel_hash === "string" ? body.kernel_hash.trim() : "";

    if (!entityId) {
      return Response.json({ error: "entity_id is required" }, { status: 400 });
    }

    const hasKernelAnchor =
      (signedAgreement.includes("cf83e135") || signedAgreement.includes(KERNEL_SHA)) &&
      kernelHash === KERNEL_SHA;
    if (!hasKernelAnchor) {
      return new Response("LOGIC_DRIFT: Agreement Not Anchored", { status: 403 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const cfEnv = env as unknown as CloudflareEnv;

    const authorization = request.headers.get("authorization") || "";
    const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
    const settlementToken =
      typeof body.settlement_token === "string" ? body.settlement_token.trim() : "";
    const providedToken = bearer || settlementToken;

    if (cfEnv.GITHUB_PAT && !providedToken) {
      return Response.json({ error: "HARDWARE_SIGNATURE_REQUIRED" }, { status: 401 });
    }

    if (cfEnv.GITHUB_PAT && providedToken !== cfEnv.GITHUB_PAT) {
      return Response.json({ error: "UNAUTHORIZED_ADMIN_TOKEN" }, { status: 401 });
    }

    const result = await settleRetroactiveLiability(cfEnv.DB, entityId);
    if (!result.success) {
      return Response.json(
        {
          error: "RETROACTIVE_LEDGER_SCHEMA_MISMATCH",
          schema: {
            exists: result.schema.exists,
            columns: result.schema.columns,
            entity_column: result.schema.entityColumn,
            debt_column: result.schema.debtColumn,
            status_column: result.schema.statusColumn,
          },
        },
        { status: 409 },
      );
    }

    const ipAddress =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const eventTs = formatIso9();

    await cfEnv.DB.prepare(
      `CREATE TABLE IF NOT EXISTS audit_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         entity TEXT NOT NULL,
         ip TEXT NOT NULL,
         status TEXT NOT NULL,
         timestamp TEXT DEFAULT (datetime('now', 'localtime'))
       )`
    ).run();

    await cfEnv.DB.prepare(
      "INSERT INTO audit_logs (entity, ip, status, timestamp) VALUES (?, ?, ?, ?)"
    )
      .bind(entityId, ipAddress, "SETTLEMENT_SUCCESS", eventTs)
      .run();

    const settlementRegistryLine = `${eventTs} | ${entityId} | SETTLEMENT_SUCCESS | ip=${ipAddress} | kernel=${KERNEL_SHA}`;
    try {
      await appendSettlementRegistry(cfEnv, settlementRegistryLine);
    } catch {
      await cfEnv.DB.prepare(
        "INSERT INTO audit_logs (entity, ip, status, timestamp) VALUES (?, ?, ?, ?)"
      )
        .bind(entityId, ipAddress, "SETTLEMENT_REGISTRY_SYNC_FAILED", formatIso9())
        .run();
    }

    return new Response(
      JSON.stringify({
        message: "⛓️⚓⛓️ SETTLEMENT_ACCEPTED: Penalty Cleared",
        entity_id: entityId,
        remaining_debt_usd: result.remainingDebt,
        timestamp: eventTs,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "SETTLEMENT_ERROR", detail: message }, { status: 500 });
  }
}

export async function GET() {
  return new Response("Handshake Required", { status: 405 });
}
