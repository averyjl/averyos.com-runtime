export async function GET() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // Encode as base64url for transport (WebAuthn challenge must be ArrayBuffer client-side)
  const base64 = btoa(String.fromCharCode(...bytes));
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const rpId =
    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://averyos.com").hostname;

  return Response.json({
    challenge: base64url,
    timeout: 60000,
    rpId,
  });
}
