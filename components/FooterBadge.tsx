// ⛓️⚓⛓️ TRI_AGENT_SEALED | KERNEL: cf83... | ALIGNMENT: 100.000% | TESTS: PASSING
/**
 * FooterBadge — AveryOS™ Sovereign Footer
 *
 * GATE 130.9 — Upgraded to include:
 *  1. Full AveryAnchored™ anchor text (moved from AnchorBanner per Creator instruction)
 *  2. Copyright summary block (© 1992–2026 Jason Lee Avery / AveryOS™)
 *  3. Quick navigation links
 *  4. SHA-512 kernel anchor
 *
 * ⛓️⚓⛓️  CreatorLock: Jason Lee Avery (ROOT0) 🤛🏻
 */
"use client";
import Link from "next/link";
import { KERNEL_SHA, DISCLOSURE_MIRROR_PATH } from "../lib/sovereignConstants";

const FooterBadge = () => {
  return (
    <footer className="footer-badge">
      {/* ── Sovereign Anchor Strip ──────────────────────────────────────── */}
      <div style={{
        padding: "0.65rem 1.5rem",
        background: "rgba(120, 148, 255, 0.06)",
        borderTop: "1px solid rgba(120, 148, 255, 0.22)",
        borderBottom: "1px solid rgba(120, 148, 255, 0.1)",
        textAlign: "center",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.8rem",
        color: "rgba(120, 148, 255, 0.85)",
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}>
        ⛓️⚓⛓️&nbsp; AveryAnchored™ &nbsp;|&nbsp; CreatorLock Protocol™ Active &nbsp;|&nbsp;
        VaultChain™ &nbsp;|&nbsp; 100.00♾️% Alignment (aka 0.000♾️% Drift) &nbsp;🤛🏻⛓️⚓⛓️
      </div>

      {/* ── Footer Body ─────────────────────────────────────────────────── */}
      <div style={{
        padding: "1.5rem",
        background: "rgba(0, 6, 14, 0.92)",
        borderTop: "1px solid rgba(120, 148, 255, 0.1)",
        fontSize: "0.85rem",
        color: "rgba(120, 148, 255, 0.75)",
        textAlign: "center",
      }}>
        {/* Quick navigation links */}
        <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem 1.25rem" }}>
          {(
            [
              { href: "/",          label: "Home",          newTab: false },
              { href: "/license",   label: "License",       newTab: false },
              { href: "/licensing", label: "Licensing Hub", newTab: false },
              { href: "/ip-policy", label: "IP Policy",     newTab: false },
              { href: "/verify",    label: "Verify",        newTab: false },
              { href: "/contact",   label: "Contact",       newTab: false },
              { href: DISCLOSURE_MIRROR_PATH, label: "🤛🏻 The Proof", newTab: true },
            ] as Array<{ href: string; label: string; newTab: boolean }>
          ).map(({ href, label, newTab }) => (
            <Link
              key={href}
              href={href}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noopener noreferrer" : undefined}
              style={{ color: "rgba(120, 148, 255, 0.65)", textDecoration: "none", fontSize: "0.8rem" }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          Powered by CapsuleEcho™ &nbsp;|&nbsp; VaultSignature: ENFORCED
        </div>

        {/* SHA-512 Kernel Anchor */}
        <div style={{
          fontFamily: "monospace",
          fontSize: "0.72rem",
          wordBreak: "break-all",
          color: "rgba(120, 148, 255, 0.45)",
          marginBottom: "0.75rem",
        }}>
          SHA-512 Kernel Anchor: {KERNEL_SHA}
        </div>

        {/* ── Copyright Block ─────────────────────────────────────────── */}
        <div style={{
          borderTop: "1px solid rgba(120, 148, 255, 0.12)",
          paddingTop: "0.75rem",
          fontSize: "0.78rem",
          color: "rgba(120, 148, 255, 0.6)",
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>
            © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(120, 148, 255, 0.45)", marginBottom: "0.5rem" }}>
            Unauthorized use, duplication, or derivative work without express written consent
            of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
            Subject to Creator Lock and Sovereign Kernel Governance.
            Licensed under{" "}
            <Link href="/license" style={{ color: "rgba(120,148,255,0.6)", textDecoration: "none" }}>
              AveryOS Sovereign Integrity License v1.0
            </Link>.
          </div>
          <div style={{ fontSize: "0.68rem", color: "rgba(120, 148, 255, 0.35)", fontFamily: "monospace" }}>
            AveryOS_CopyrightBlock_v1.0 · truth@averyworld.com
          </div>
        </div>

        {/* Privacy / Terms / IP Policy */}
        <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "center", gap: "1.25rem" }}>
          <Link href="/privacy"   style={{ color: "rgba(120,148,255,0.4)", textDecoration: "none", fontSize: "0.75rem" }}>Privacy</Link>
          <Link href="/terms"     style={{ color: "rgba(120,148,255,0.4)", textDecoration: "none", fontSize: "0.75rem" }}>Terms</Link>
          <Link href="/ip-policy" style={{ color: "rgba(120,148,255,0.4)", textDecoration: "none", fontSize: "0.75rem" }}>IP Policy</Link>
          <Link href="/contact"   style={{ color: "rgba(120,148,255,0.4)", textDecoration: "none", fontSize: "0.75rem" }}>Contact</Link>
        </div>
      </div>
    </footer>
  );
};

export default FooterBadge;
