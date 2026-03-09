"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const PURPLE_DEEP = "#0a0015";
const GOLD = "#ffd700";
const GOLD_DIM = "rgba(255,215,0,0.55)";
const GOLD_BORDER = "rgba(255,215,0,0.35)";
const GOLD_GLOW = "rgba(255,215,0,0.1)";
const RED = "#ff4444";

interface RevenueTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function formatUsd(value: string | number) {
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function RevenueTooltip({ active, payload, label }: RevenueTooltipProps) {
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
      <div style={{ color: GOLD_DIM, marginBottom: "2px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name}>{formatUsd(p.value)}</div>
      ))}
    </div>
  );
}

interface LiabilityBarChartProps {
  chartData: Array<{ org: string; liability: number }>;
  threshold: number;
}

export default function LiabilityBarChart({ chartData, threshold }: LiabilityBarChartProps) {
  if (chartData.length === 0) return null;

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
        💰 TOP CORPORATE LIABILITY — Uncollected Alignment Fees
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,215,0,0.08)" vertical={false} />
          <XAxis
            dataKey="org"
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: GOLD_DIM, fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<RevenueTooltip />} cursor={{ fill: GOLD_GLOW }} />
          <Bar dataKey="liability" maxBarSize={32} radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.liability >= threshold ? RED : GOLD}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div
        style={{
          marginTop: "0.5rem",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.68rem",
          color: GOLD_DIM,
        }}
      >
        🔴 Red = Above $10,000 threshold (auto-invoice eligible) &nbsp;|&nbsp; 🟡 Gold = Below threshold
      </div>
    </div>
  );
}
