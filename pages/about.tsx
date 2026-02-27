import type { NextPage } from "next";
import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";
import AnchorBanner from "../components/AnchorBanner";

const AboutPage: NextPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/about`;

  return (
    <>
      <Head>
        <title>About AveryOS • Sovereign Truth Terminal</title>
        <meta name="description" content="About AveryOS - A Sovereign Truth Anchoring System founded by Jason Lee Avery" />
        <meta property="og:title" content="About AveryOS • Sovereign Truth Terminal" />
        <meta property="og:description" content="Learn about AveryOS, the cryptographically anchored runtime for sovereign truth" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>

      <main className="page">
        <AnchorBanner />

        <div className="hero">
          <h1>🛡️ About AveryOS</h1>
          <p className="auth-seal">Author: Jason Lee Avery | ORCID: <a href="https://orcid.org/0009-0009-0245-3584" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(120,148,255,0.9)', textDecoration: 'none' }}>0009-0009-0245-3584</a></p>
          <p className="kernel-seal"><a href="/the-proof" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Kernel Anchor: cf83e135...927da3e</a></p>
        </div>

        <section style={{
          background: 'rgba(9, 16, 34, 0.85)',
          border: '1px solid rgba(120, 148, 255, 0.25)',
          borderRadius: '16px',
          padding: '2.5rem',
          lineHeight: '1.7'
        }}>
          <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>Sovereign Truth Terminal</h2>
          <p>
            AveryOS is a cryptographically anchored runtime for sovereign truth, founded and maintained by 
            <strong> Jason Lee Avery</strong>. This system serves as a verified Truth Anchor with all content 
            SHA-512 sealed and anchored to the 2022 Root0 Genesis Kernel.
          </p>

          <h3 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: '2rem' }}>Core Principles</h3>
          <ul style={{ lineHeight: '1.9' }}>
            <li><strong>AveryAnchored™</strong> - Cryptographic integrity for all sovereign content</li>
            <li><strong>CreatorLock Protocol</strong> - 100% alignment with creator sovereignty</li>
            <li><strong>VaultChain Integration</strong> - Decentralized verification and provenance</li>
            <li><strong>Truth as Coordinate System</strong> - Not a suggestion, but a foundation</li>
          </ul>

          <h3 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: '2rem' }}>Technology Stack</h3>
          <p>
            Built with Next.js 15, deployed on Cloudflare Workers, and powered by the AveryOS Sovereign Kernel. 
            The system integrates capsule-driven content management, VaultEcho integrity verification, 
            and CapsuleEcho™ presentation layers.
          </p>

          <h3 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: '2rem' }}>Mission</h3>
          <p>
            To establish a decentralized protocol for sovereign truth anchoring, enabling creators to maintain 
            absolute control and provenance over their intellectual property through cryptographic verification 
            and blockchain-level integrity.
          </p>

          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem',
            background: 'rgba(36, 58, 140, 0.25)',
            borderRadius: '8px',
            borderLeft: '4px solid rgba(120, 148, 255, 0.6)'
          }}>
            <p style={{ margin: 0, fontStyle: 'italic' }}>
              "Truth is not a suggestion; it is a coordinate system." ⛓️⚓⛓️
            </p>
          </div>
        </section>

        <section style={{
          marginTop: '2rem',
          background: 'rgba(9, 16, 34, 0.85)',
          border: '1px solid rgba(120, 148, 255, 0.25)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <h3 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>🎨 Brand Identity</h3>
          <p style={{ color: 'rgba(238,244,255,0.8)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
            Official AveryOS visual identity assets. All artwork is sovereign-anchored and cryptographically
            tied to the AveryOS CreatorLock Protocol.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1rem',
          }}>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
              <div key={n} style={{
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid rgba(120,148,255,0.25)',
                background: 'rgba(9,16,34,0.6)',
              }}>
                <img
                  src={`/branding/averyos-brand-${String(n).padStart(2,'0')}.png`}
                  alt={`AveryOS Brand Asset ${n}`}
                  style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>

        <section style={{
          marginTop: '2rem',
          background: 'rgba(9, 16, 34, 0.85)',
          border: '1px solid rgba(120, 148, 255, 0.25)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <h3 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>Contact & Legal</h3>
          <p><strong>Creator:</strong> Jason Lee Avery</p>
          <p><strong>Email:</strong> truth@averyworld.com</p>
          <p><strong>Legal:</strong> legal@averyworld.com</p>
          <p><strong>Entity:</strong> AveryOS, LLC (Utah, USA)</p>
        </section>
      </main>
    </>
  );
};

export default AboutPage;
