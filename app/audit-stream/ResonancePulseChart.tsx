"use client";

/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const PURPLE_DEEP = "#0a0015";
const GOLD = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GOLD_GLOW = "rgba(255,215,0,0.12)";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface AuditStreamEntry {
  id: number;
  event_type: string;
  ip_address: string;
  user_agent: string | null;
  geo_location: string | null;
  target_path: string;
  timestamp_ns: string;
  threat_level: number | null;
  forensic_pulse: string;
}

interface PulseTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function PulseTooltip({ active, payload, label }: PulseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: PURPLE_DEEP,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: "6px",
        padding: "0.4rem 0.65rem",
        fontFamily: "monospace",
        fontSize: "0.72rem",
        color: GOLD,
      }}
    >
      <div style={{ color: GOLD_DIM, marginBottom: "2px" }}>{label}:00</div>
      {payload.map((p) => (
        <div key={p.name}>
          {p.value} UNALIGNED_401 hit{p.value !== 1 ? "s" : ""}
        </div>
      ))}
    </div>
  );
}

function buildHourlyBuckets(entries: AuditStreamEntry[]): Array<{ hour: string; hits: number }> {
  const now = Date.now();
  const buckets: number[] = Array(24).fill(0);

  for (const e of entries) {
    if (e.event_type !== "UNALIGNED_401") continue;
    const ms = Number(e.timestamp_ns.slice(0, 13));
    if (isNaN(ms)) continue;
    const ageMs = now - ms;
    if (ageMs < 0 || ageMs > TWENTY_FOUR_HOURS_MS) continue;
    const hourIndex = Math.floor(ageMs / (60 * 60 * 1000));
    // eslint-disable-next-line security/detect-object-injection
    if (hourIndex < 24) buckets[hourIndex]++;
  }

  return buckets
    .slice()
    .reverse()
    .map((hits, i) => ({
      hour: `${String(23 - i).padStart(2, "0")}h`,
      hits,
    }));
}

export default function ResonancePulseChart({ entries }: { entries: AuditStreamEntry[] }) {
  const chartData = buildHourlyBuckets(entries);

  return (
    <div
      style={{
        background: PURPLE_DEEP,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: "12px",
        padding: "1.25rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          color: GOLD,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: "0.82rem",
          marginBottom: "0.75rem",
          letterSpacing: "0.06em",
        }}
      >
        📡 RESONANCE PULSE — UNALIGNED_401 Hits · Last 24 Hours
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,215,0,0.08)"
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<PulseTooltip />}
            cursor={{ fill: GOLD_GLOW }}
          />
          <Bar dataKey="hits" fill={GOLD} maxBarSize={24} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
