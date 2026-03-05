"use client";

import type { AosUiError } from "../lib/sovereignError";

interface SovereignErrorBannerProps {
  error: AosUiError | null;
  /** Optional override title. Defaults to "⚠️ AveryOS™ Error" */
  title?: string;
  /** Show/hide the actionable steps list. Default: true */
  showSteps?: boolean;
  /** Extra inline styles on the container. */
  style?: React.CSSProperties;
}

/**
 * AveryOS™ Sovereign Error Banner
 *
 * Displays a clear, actionable error with RCA diagnosis and recovery steps.
 * Pass `null` to render nothing (ideal for conditional rendering).
 *
 * Usage:
 * ```tsx
 * import SovereignErrorBanner from "@/components/SovereignErrorBanner";
 * import { buildAosUiError, AOS_ERROR } from "@/lib/sovereignError";
 *
 * const [uiError, setUiError] = useState<AosUiError | null>(null);
 *
 * // On fetch failure:
 * setUiError(buildAosUiError(AOS_ERROR.DB_UNAVAILABLE, err.message));
 *
 * return <SovereignErrorBanner error={uiError} />;
 * ```
 */
export default function SovereignErrorBanner({
  error,
  title = "⚠️ AveryOS™ Error",
  showSteps = true,
  style,
}: SovereignErrorBannerProps) {
  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background: "rgba(30, 0, 0, 0.95)",
        border: "1px solid rgba(248, 113, 113, 0.55)",
        borderRadius: "10px",
        padding: "1.1rem 1.35rem",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.82rem",
        lineHeight: "1.65",
        color: "#fef2f2",
        marginBottom: "1rem",
        ...style,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.5rem",
          marginBottom: "0.55rem",
        }}
      >
        <span style={{ color: "#f87171", fontWeight: 700, fontSize: "0.88rem" }}>
          {title}
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            padding: "0.15rem 0.45rem",
            borderRadius: "3px",
            background: "rgba(248,113,113,0.12)",
            border: "1px solid rgba(248,113,113,0.35)",
            color: "#f87171",
            whiteSpace: "nowrap",
          }}
        >
          {error.code}
        </span>
      </div>

      {/* Diagnosis */}
      <div style={{ color: "#fef2f2", marginBottom: "0.45rem" }}>
        <span style={{ color: "rgba(248,113,113,0.7)" }}>Diagnosis: </span>
        {error.diagnosis}
      </div>

      {/* Detail */}
      {error.detail && error.detail !== error.diagnosis && (
        <div
          style={{
            color: "rgba(254,242,242,0.6)",
            fontSize: "0.75rem",
            marginBottom: "0.55rem",
            wordBreak: "break-word",
          }}
        >
          {error.detail}
        </div>
      )}

      {/* Actionable steps */}
      {showSteps && error.steps.length > 0 && (
        <div style={{ marginTop: "0.65rem" }}>
          <div
            style={{
              color: "#86efac",
              fontWeight: 600,
              fontSize: "0.75rem",
              marginBottom: "0.35rem",
            }}
          >
            ✅ What to do:
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              color: "#bbf7d0",
              fontSize: "0.78rem",
            }}
          >
            {error.steps.map((step, i) => (
              <li key={i} style={{ marginBottom: "0.2rem" }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Sovereign anchor */}
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "0.68rem",
          color: "rgba(248,113,113,0.4)",
          borderTop: "1px solid rgba(248,113,113,0.15)",
          paddingTop: "0.45rem",
        }}
      >
        ⛓️⚓⛓️ AveryOS™ Sovereign Error Standard · Auto-heal attempted
      </div>
    </div>
  );
}
