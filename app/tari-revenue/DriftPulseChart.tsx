"use client";

/**
 * app/tari-revenue/DriftPulseChart.tsx
 *
 * AveryOS™ DriftPulse™ Recharts Visualization — Roadmap Gate 6
 *
 * Renders a LineChart of drift_metrics data, showing:
 *   • statutory_debt_usd  — cumulative TARI™ statutory liability (red line)
 *   • active_licenses     — active sovereign licenses (green line)
 *
 * Data is fetched from /api/v1/tari-stats and transformed into time-series
 * points for Recharts rendering.  Uses dynamic import (ssr: false) from the
 * parent page to avoid bundling Recharts in the Cloudflare Worker SSR pass.
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// ── Theme ─────────────────────────────────────────────────────────────────────
const PURPLE_DEEP = "#0a0015";
const GOLD        = "#ffd700";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GREEN       = "#4ade80";
const RED         = "#ff4444";
const MUTED       = "rgba(200,210,255,0.55)";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriftMetricPoint {
  /** ISO timestamp label for x-axis */
  label:              string;
  /** Cumulative statutory debt in USD at this data point */
  statutory_debt_usd: number;
  /** Number of active licenses at this data point */
  active_licenses:    number;
}

interface DriftPulseChartProps {
  data: DriftMetricPoint[];
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name:  string;
  value: number;
  color: string;
}

interface DriftTooltipProps {
  active?:  boolean;
  payload?: TooltipPayloadItem[];
  label?:   string;
}

function DriftTooltip({ active, payload, label }: DriftTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   PURPLE_DEEP,
      border:       `1px solid ${GOLD_BORDER}`,
      borderRadius: "6px",
      padding:      "0.5rem 0.75rem",
      fontFamily:   "JetBrains Mono, monospace",
      fontSize:     "0.72rem",
      color:        GOLD,
    }}>
      <div style={{ color: MUTED, marginBottom: "4px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}:{" "}
          {p.name === "Statutory Debt"
            ? `$${Number(p.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

// ── Main Chart Component ──────────────────────────────────────────────────────

export default function DriftPulseChart({ data }: DriftPulseChartProps) {
  if (!data.length) {
    return (
      <div style={{
        background:     PURPLE_DEEP,
        border:         `1px solid ${GOLD_BORDER}`,
        borderRadius:   "12px",
        padding:        "1.25rem",
        minHeight:      "200px",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        color:          MUTED,
        fontFamily:     "JetBrains Mono, monospace",
        fontSize:       "0.8rem",
      }}>
        📊 No drift_metrics data available yet — data accumulates as TARI™ events are logged.
      </div>
    );
  }

  return (
    <div style={{
      background:   PURPLE_DEEP,
      border:       `1px solid ${GOLD_BORDER}`,
      borderRadius: "12px",
      padding:      "1.25rem",
    }}>
      <div style={{
        fontSize:     "0.8rem",
        color:        GOLD,
        fontFamily:   "JetBrains Mono, monospace",
        marginBottom: "0.75rem",
        fontWeight:   700,
      }}>
        📈 DriftPulse™ — Statutory Debt vs. Active Licenses
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tick={{ fill: MUTED, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={{ stroke: GOLD_BORDER }}
          />
          <YAxis
            yAxisId="debt"
            orientation="left"
            tick={{ fill: RED, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            tickFormatter={(v: number) =>
              v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
              v >= 1_000     ? `$${(v / 1_000).toFixed(0)}k`     :
              `$${v}`
            }
            tickLine={false}
            axisLine={{ stroke: "rgba(255,68,68,0.3)" }}
          />
          <YAxis
            yAxisId="licenses"
            orientation="right"
            tick={{ fill: GREEN, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(74,222,128,0.3)" }}
          />
          <Tooltip content={<DriftTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: MUTED }}
          />
          <ReferenceLine
            yAxisId="debt"
            y={0}
            stroke={GOLD_BORDER}
            strokeDasharray="3 3"
          />
          <Line
            yAxisId="debt"
            type="monotone"
            dataKey="statutory_debt_usd"
            name="Statutory Debt"
            stroke={RED}
            strokeWidth={2}
            dot={{ fill: RED, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="licenses"
            type="monotone"
            dataKey="active_licenses"
            name="Active Licenses"
            stroke={GREEN}
            strokeWidth={2}
            dot={{ fill: GREEN, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize: "0.68rem", color: MUTED, marginTop: "0.5rem", textAlign: "right" }}>
        9-digit ISO-9 precision · AveryOS™ TARI™ DriftPulse™ v1.0
      </div>
    </div>
  );
}
