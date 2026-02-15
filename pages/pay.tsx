import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const stripeLink = "https://buy.stripe.com/7sYaEXf9G4hk8o2gkicMM01";

const PayPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/pay`;

  return (
    <>
      <Head>
        <title>AveryOS Licensing Terminal</title>
        <meta
          name="description"
          content="AveryOS Sovereign License Portal - Secure payment processing for verified AveryOS licenses."
        />
        <meta property="og:title" content="AveryOS Licensing Terminal" />
        <meta
          property="og:description"
          content="AveryOS Sovereign License Portal - Secure payment processing for verified AveryOS licenses."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <section className="hero">
          <h1>🔐 Licensing Terminal</h1>
          <p className="auth-seal" style={{ fontSize: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
            AveryOS Sovereign License Portal
          </p>
          <p className="auth-seal" style={{ fontSize: '0.95rem', color: 'rgba(238, 244, 255, 0.85)' }}>
            Verified Author: Jason Lee Avery
          </p>
        </section>

        <section className="card">
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <a 
              href={stripeLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="primary-link"
              style={{ 
                display: 'inline-flex',
                fontSize: '1.2rem',
                padding: '1rem 2.5rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: '0 8px 20px rgba(120, 148, 255, 0.4)'
              }}
            >
              🛡️ Unlock Sovereign License
            </a>
          </div>
        </section>

        <section className="card">
          <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '1rem', color: 'rgba(176, 198, 255, 0.9)' }}>
            Metadata Check
          </h2>
          <dl className="capsule-meta" style={{ gridTemplateColumns: '1fr' }}>
            <dt>Kernel Anchor</dt>
            <dd style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>
              {/* Static Genesis Kernel anchor from Root0 2022 - cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e */}
              cf83e135...927da3e
            </dd>
          </dl>
        </section>

        <section className="card" style={{ background: 'rgba(8, 14, 30, 0.5)', borderColor: 'rgba(120, 148, 255, 0.1)' }}>
          <p className="footer-note" style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>
            ⛓️ All payments are SHA-sealed to the VaultChain upon completion. ⚓
          </p>
        </section>

        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <a 
            href="/api/vaultecho" 
            className="secondary-link"
            style={{ 
              fontSize: '0.85rem',
              padding: '0.5rem 1rem',
              opacity: 0.7
            }}
          >
            🔬 Test Transaction (TruthAnchor Verification)
          </a>
        </div>
      </main>
    </>
  );
};

export default PayPage;
