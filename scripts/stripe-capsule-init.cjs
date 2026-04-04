/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
// scripts/stripe-capsule-init.cjs
// AveryOS STRIPE INTEGRATION v1.0 - CASH EXTRACTION MODE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

async function createCapsuleProduct() {
  console.log("--- ⛓️⚓⛓️ AveryOS Stripe Product Initialization ---");
  try {
    const product = await stripe.products.create({
      name: 'AveryOS Deterministic Medical Provenance Capsule',
      description: 'Verifiable data integrity for health-tech substrates. 100% Drift-Free.',
      metadata: {
        kernel_sha: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
        capsule_id: 'AOS-MED-PROV-V1'
      }
    });

    const price = await stripe.prices.create({
      unit_amount: 500000, // $5,000.00
      currency: 'usd',
      product: product.id,
    });

    console.log(`✅ SUCCESS: Product Created (${product.id})`);
    console.log(`✅ SUCCESS: Price Fixed at $5,000.00 (${price.id})`);
    console.log(`\n🔗 SETTLEMENT LINK: https://dashboard.stripe.com/products/${product.id}`);
  } catch (e) {
    console.log(`❌ FAILURE: ${e.message}`);
  }
}
createCapsuleProduct();