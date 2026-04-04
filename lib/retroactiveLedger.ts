/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

type SchemaColumnRow = {
  name: string;
};

export interface RetroactiveLedgerSchema {
  exists: boolean;
  columns: string[];
  entityColumn: string | null;
  debtColumn: string | null;
  hashColumn: string | null;
  statusColumn: string | null;
  timestampColumn: string | null;
}

export interface RetroactiveDebtSummary {
  totalDebtUsd: number;
  totalDebtPrecision9: string;
  rowCount: number;
  schema: RetroactiveLedgerSchema;
}

export interface ForensicLedgerEntry {
  entity_name: string;
  forensic_hash: string;
  liability_usd: number | null;
  status: string | null;
  timestamp: string | null;
}

const ENTITY_CANDIDATES = ["entity_name", "entity_id", "entity"];
const DEBT_CANDIDATES = ["liability_usd", "debt_usd", "total_debt_usd", "amount_usd"];
const HASH_CANDIDATES = ["forensic_hash", "anchor_sha", "sha512", "hash_sha512", "evidence_hash"];
const STATUS_CANDIDATES = ["settlement_status", "status"];
const TIMESTAMP_CANDIDATES = ["timestamp", "created_at", "event_timestamp", "updated_at"];

function pickPreferredColumn(columns: string[], candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (columns.includes(candidate)) return candidate;
  }
  return null;
}

function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Invalid SQL identifier");
  }
  return name;
}

export async function getRetroactiveLedgerSchema(db: D1Database): Promise<RetroactiveLedgerSchema> {
  const table = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'retroactive_ledger' LIMIT 1")
    .first<{ name: string }>();

  if (!table) {
    return {
      exists: false,
      columns: [],
      entityColumn: null,
      debtColumn: null,
      hashColumn: null,
      statusColumn: null,
      timestampColumn: null,
    };
  }

  const { results } = await db
    .prepare("PRAGMA table_info(retroactive_ledger)")
    .all<SchemaColumnRow>();
  const columns = results.map((row) => row.name);

  return {
    exists: true,
    columns,
    entityColumn: pickPreferredColumn(columns, ENTITY_CANDIDATES),
    debtColumn: pickPreferredColumn(columns, DEBT_CANDIDATES),
    hashColumn: pickPreferredColumn(columns, HASH_CANDIDATES),
    statusColumn: pickPreferredColumn(columns, STATUS_CANDIDATES),
    timestampColumn: pickPreferredColumn(columns, TIMESTAMP_CANDIDATES),
  };
}

export async function getRetroactiveDebtSummary(db: D1Database): Promise<RetroactiveDebtSummary> {
  const schema = await getRetroactiveLedgerSchema(db);

  if (!schema.exists || !schema.debtColumn) {
    return {
      totalDebtUsd: 0,
      totalDebtPrecision9: "0.000000000",
      rowCount: 0,
      schema,
    };
  }

  const debtColumn = quoteIdentifier(schema.debtColumn);
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CAST(${debtColumn} AS REAL)), 0) AS totalDebtUsd, COUNT(*) AS rowCount FROM retroactive_ledger`
    )
    .first<{ totalDebtUsd: number; rowCount: number }>();

  const totalDebtUsd = Number(row?.totalDebtUsd ?? 0);
  const rowCount = Number(row?.rowCount ?? 0);

  return {
    totalDebtUsd,
    totalDebtPrecision9: totalDebtUsd.toFixed(9),
    rowCount,
    schema,
  };
}

export async function getForensicHashesFromLedger(
  db: D1Database,
  limit = 50,
): Promise<{ entries: ForensicLedgerEntry[]; schema: RetroactiveLedgerSchema }> {
  const schema = await getRetroactiveLedgerSchema(db);
  if (!schema.exists || !schema.hashColumn) {
    return { entries: [], schema };
  }

  const hashColumn = quoteIdentifier(schema.hashColumn);
  const entitySelect = schema.entityColumn
    ? `${quoteIdentifier(schema.entityColumn)} AS entity_name`
    : `'' AS entity_name`;
  const debtSelect = schema.debtColumn
    ? `CAST(${quoteIdentifier(schema.debtColumn)} AS REAL) AS liability_usd`
    : `NULL AS liability_usd`;
  const statusSelect = schema.statusColumn
    ? `${quoteIdentifier(schema.statusColumn)} AS status`
    : `NULL AS status`;
  const timestampSelect = schema.timestampColumn
    ? `${quoteIdentifier(schema.timestampColumn)} AS timestamp`
    : `NULL AS timestamp`;
  const orderBy = schema.timestampColumn ? quoteIdentifier(schema.timestampColumn) : "rowid";

  const { results } = await db
    .prepare(
      `SELECT ${entitySelect}, ${hashColumn} AS forensic_hash, ${debtSelect}, ${statusSelect}, ${timestampSelect}
       FROM retroactive_ledger
       WHERE ${hashColumn} IS NOT NULL AND TRIM(${hashColumn}) != ''
       ORDER BY ${orderBy} DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<ForensicLedgerEntry>();

  return { entries: results, schema };
}

export async function settleRetroactiveLiability(
  db: D1Database,
  entityId: string,
): Promise<{ success: boolean; schema: RetroactiveLedgerSchema; remainingDebt: number | null }> {
  const schema = await getRetroactiveLedgerSchema(db);
  if (!schema.exists || !schema.debtColumn || !schema.entityColumn) {
    return { success: false, schema, remainingDebt: null };
  }

  const debtColumn = quoteIdentifier(schema.debtColumn);
  const entityColumn = quoteIdentifier(schema.entityColumn);
  const statusSql = schema.statusColumn
    ? `, ${quoteIdentifier(schema.statusColumn)} = 'RESOLVED'`
    : "";

  await db
    .prepare(
      `UPDATE retroactive_ledger
       SET ${debtColumn} = CAST(COALESCE(${debtColumn}, 0) AS REAL) - 10000.00
           ${statusSql}
       WHERE ${entityColumn} = ?`
    )
    .bind(entityId)
    .run();

  const remaining = await db
    .prepare(
      `SELECT CAST(${debtColumn} AS REAL) AS remainingDebt
       FROM retroactive_ledger
       WHERE ${entityColumn} = ?
       ORDER BY rowid DESC
       LIMIT 1`
    )
    .bind(entityId)
    .first<{ remainingDebt: number }>();

  return {
    success: true,
    schema,
    remainingDebt: remaining?.remainingDebt ?? null,
  };
}
