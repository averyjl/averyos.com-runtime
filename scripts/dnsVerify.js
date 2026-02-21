const dns = require('dns').promises;

async function verifyDnsAnchor() {
  const domain = 'sovereign.averyos.com';
  try {
    const records = await dns.resolveTxt(domain);
    const flatRecords = records.flat();
    console.log("🌐 Cloudflare DNS Anchor Found:", flatRecords);
    // Logic to compare flatRecords[0] with local .sovereign-lock hash
  } catch (err) {
    console.error("❌ DNS Verification Failed: Possible Man-in-the-Middle detected.");
  }
}
verifyDnsAnchor();
