export function formatIso9(input?: string | Date | null): string {
  const source = input ?? new Date();
  const date = source instanceof Date ? source : new Date(source);

  if (Number.isNaN(date.getTime())) {
    return typeof source === "string" ? source : "";
  }

  const iso = date.toISOString();
  const [left, right] = iso.split(".");
  const milli = (right || "000Z").replace("Z", "").slice(0, 3).padEnd(3, "0");
  return `${left}.${milli}000000Z`;
}
