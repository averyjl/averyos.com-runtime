/**
 * Get sub-millisecond nanosecond digits (6 digits: microseconds + nanoseconds)
 * without rounding or trailing zeros.
 *
 * Strategy (in priority order):
 *   1. Node.js ≥ 10: `process.hrtime.bigint()` — true nanosecond precision.
 *   2. Web / Cloudflare Workers: `performance.now()` fractional part — μs precision.
 *   3. Fallback: returns "000000" (millisecond-only precision).
 *
 * The returned string is always exactly 6 characters representing the
 * sub-millisecond portion of the current clock (microseconds + nanoseconds).
 */
function subMilliDigits(): string {
  // Node.js path: process.hrtime.bigint() gives nanoseconds since process start.
  // Extract the nanosecond remainder after removing whole-millisecond multiples.
  if (
    typeof process !== "undefined" &&
    typeof process.hrtime === "function" &&
    typeof (process.hrtime as { bigint?: () => bigint }).bigint === "function"
  ) {
    const ns = (process.hrtime as { bigint: () => bigint }).bigint();
    // nanoseconds within the current millisecond: ns % 1_000_000n
    const subMs = Number(ns % 1_000_000n);
    return subMs.toString().padStart(6, "0");
  }

  // Web / Cloudflare Workers: performance.now() returns fractional milliseconds.
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    const fracMs = performance.now() % 1;            // fractional part within current ms
    const totalSubMsNanos = Math.floor(fracMs * 1_000_000); // total ns in sub-ms window
    const subMicros = Math.floor(totalSubMsNanos / 1000);   // microseconds 0–999
    const subNanos  = totalSubMsNanos % 1000;                // nanoseconds 0–999
    return `${subMicros.toString().padStart(3, "0")}${subNanos.toString().padStart(3, "0")}`;
  }

  return "000000";
}

export function formatIso9(input?: string | Date | null): string {
  const source = input ?? new Date();
  const date = source instanceof Date ? source : new Date(source);

  if (Number.isNaN(date.getTime())) {
    return typeof source === "string" ? source : "";
  }

  const iso = date.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right || "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");

  // When input is explicitly provided (not "now"), we cannot add live sub-ms digits
  // because the input timestamp is already baked into the Date — use zeros for
  // the sub-ms portion to avoid misrepresenting historical timestamps.
  // When called as formatIso9() with no argument, inject live precision digits.
  const sub6 = input == null ? subMilliDigits() : "000000";

  return `${left}.${milli}${sub6}Z`;
}
