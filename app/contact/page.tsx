import type { Metadata } from "next";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";

export const metadata: Metadata = {
  title: "Contact • AveryOS",
  description: "Contact AveryOS - Get in touch with Jason Lee Avery and the AveryOS team",
  openGraph: {
    title: "Contact • AveryOS",
    description: "Contact information for AveryOS, LLC",
    type: "website",
    url: "https://averyos.com/contact",
  },
  alternates: { canonical: "https://averyos.com/contact" },
};

export default function ContactPage() {
  return (
    <main className="page">
      <AnchorBanner />

      <div className="hero">
        <h1>📬 Contact AveryOS</h1>
        <p>Get in touch with the AveryOS team</p>
      </div>

      <section style={{
        background: 'rgba(9, 16, 34, 0.85)',
        border: '1px solid rgba(120, 148, 255, 0.25)',
        borderRadius: '16px',
        padding: '2.5rem'
      }}>
        <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>General Inquiries</h2>
        <div style={{ fontSize: '1.1rem', lineHeight: '2' }}>
          <p>
            <strong>Email:</strong>{" "}
            <a 
              href="mailto:truth@averyworld.com" 
              style={{ color: 'rgba(120, 148, 255, 0.9)', textDecoration: 'none' }}
            >
              truth@averyworld.com
            </a>
          </p>
          <p><strong>Creator:</strong> Jason Lee Avery</p>
          <p><strong>ORCID:</strong> <a href="https://orcid.org/0009-0009-0245-3584" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(120,148,255,0.9)', textDecoration: 'none' }}>0009-0009-0245-3584</a></p>
        </div>
      </section>

      <section style={{
        marginTop: '2rem',
        background: 'rgba(9, 16, 34, 0.85)',
        border: '1px solid rgba(120, 148, 255, 0.25)',
        borderRadius: '16px',
        padding: '2.5rem'
      }}>
        <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>Legal & Privacy</h2>
        <div style={{ fontSize: '1.1rem', lineHeight: '2' }}>
          <p>
            <strong>Legal Department:</strong>{" "}
            <a 
              href="mailto:legal@averyworld.com" 
              style={{ color: 'rgba(120, 148, 255, 0.9)', textDecoration: 'none' }}
            >
              legal@averyworld.com
            </a>
          </p>
          <p>
            <strong>Privacy Office:</strong>{" "}
            <a 
              href="mailto:truth@averyworld.com" 
              style={{ color: 'rgba(120, 148, 255, 0.9)', textDecoration: 'none' }}
            >
              truth@averyworld.com
            </a>
          </p>
        </div>
      </section>

      <section style={{
        marginTop: '2rem',
        background: 'rgba(9, 16, 34, 0.85)',
        border: '1px solid rgba(120, 148, 255, 0.25)',
        borderRadius: '16px',
        padding: '2.5rem'
      }}>
        <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>Business Information</h2>
        <div style={{ fontSize: '1.1rem', lineHeight: '2' }}>
          <p><strong>Entity:</strong> AveryOS, LLC</p>
          <p><strong>Jurisdiction:</strong> Utah, USA</p>
          <p><strong>License:</strong> AveryOS Sovereign Integrity License v1.0</p>
        </div>
      </section>

      <section style={{
        marginTop: '2rem',
        background: 'rgba(9, 16, 34, 0.85)',
        border: '1px solid rgba(120, 148, 255, 0.25)',
        borderRadius: '16px',
        padding: '2.5rem'
      }}>
        <h2 style={{ color: 'rgba(122, 170, 255, 0.9)', marginTop: 0 }}>Support & Technical</h2>
        <p style={{ fontSize: '1.05rem', lineHeight: '1.7' }}>
          For technical support, licensing inquiries, or partnership opportunities, 
          please reach out via email at{" "}
          <a 
            href="mailto:truth@averyworld.com" 
            style={{ color: 'rgba(120, 148, 255, 0.9)', textDecoration: 'none' }}
          >
            truth@averyworld.com
          </a>
        </p>
        <p style={{ fontSize: '1.05rem', lineHeight: '1.7', marginTop: '1.5rem' }}>
          For DMCA or IP claims, contact{" "}
          <a 
            href="mailto:legal@averyworld.com" 
            style={{ color: 'rgba(120, 148, 255, 0.9)', textDecoration: 'none' }}
          >
            legal@averyworld.com
          </a>
        </p>
      </section>

      <div style={{ 
        marginTop: '2rem', 
        padding: '1.5rem',
        background: 'rgba(36, 58, 140, 0.25)',
        borderRadius: '8px',
        borderLeft: '4px solid rgba(120, 148, 255, 0.6)',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>
          All communications are subject to the AveryOS Terms of Service and Privacy Policy
        </p>
      </div>
      <FooterBadge />
    </main>
  );
}
