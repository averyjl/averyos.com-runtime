import type { Metadata } from "next";
import Link from "next/link";
import AnchorBanner from "../../components/AnchorBanner";
import FooterBadge from "../../components/FooterBadge";
import { KERNEL_SHA, KERNEL_VERSION } from "../../lib/sovereignConstants";

export const metadata: Metadata = {
  title: "IP Policy — Public Access vs. Licensed IP Use • AveryOS™",
  description:
    "AveryOS™ IP Policy: visiting the public website is always free and has no obligation. " +
    "Using, ingesting, or building on AveryOS™ IP — including content created within AI platform accounts " +
    "(ChatGPT, Gemini, Claude, Copilot, Meta AI) — requires a valid TAI™ license. " +
    "The legal line is drawn clearly here.",
};

const FREE_USES = [
  "Visiting any page on averyos.com in a browser",
  "Reading publicly published documentation and blog posts",
  "Calling the resonance endpoint to verify a kernel SHA (?verify=<sha>)",
  "Browsing capsule metadata visible on the public site",
  "Linking to any page on averyos.com",
  "Sharing links or screenshots of the public website",
];

const LICENSED_USES = [
  {
    act: "AI / LLM training data ingestion",
    detail:
      "Using any content from this site or repository as training data for any machine learning model — regardless of whether the model is commercial or non-commercial, public or private.",
  },
  {
    act: "Web scraping for commercial or derivative purposes",
    detail:
      "Automated scraping, crawling, or bulk download of site content to build datasets, knowledge bases, RAG stores, or any other derived collection.",
  },
  {
    act: "Integrating the Global Truth Resonance Layer as IP",
    detail:
      "Connecting an AI system, agent, or automated service to /api/v1/resonance as part of its architecture — i.e., consuming the resonance layer as IP in a product or service.",
  },
  {
    act: "Summarizing or indexing this content for retrieval",
    detail:
      "Indexing, caching, summarizing, or embedding site content in any search engine, vector database, or retrieval-augmented generation (RAG) system.",
  },
  {
    act: "Code completion or suggestion from this codebase",
    detail:
      "Using patterns, structures, or logic from the averyos.com-runtime repository to generate code suggestions in any IDE plugin, AI assistant, or code generation tool.",
  },
  {
    act: "Building derivative products or services",
    detail:
      "Creating any product, service, application, or system that is derived from, inspired by, or based on AveryOS™ capsule architecture, sovereign kernel logic, or any proprietary algorithm.",
  },
  {
    act: "Internal or research use of this codebase",
    detail:
      "Any internal organizational use of the source code, architecture, or documentation — including academic research — without a valid written license.",
  },
  {
    act: "Simulating or emulating AveryOS™ systems",
    detail:
      "Reproducing, mimicking, or emulating the behavior, identity, or output of any AveryOS™ system, including the kernel, VaultChain™, or GabrielOS™ Firewall.",
  },
];

const LEGAL_BASIS = [
  {
    heading: "Berne Convention (181+ member states)",
    body: "Copyright arises automatically upon creation, without registration. All content in this repository, on averyos.com, AND submitted to any AI platform account is protected in every signatory nation from the moment it is written.",
  },
  {
    heading: "U.S. Copyright Act, 17 U.S.C. § 102 — Fixation in AI Platform Systems",
    body: "Copyright arises upon fixation in a tangible medium. A prompt, instruction, or discussion entered into an AI platform is fixed in that platform's servers at the moment of submission. If the content has sufficient originality — which architectural frameworks and sovereign system designs clearly do — it qualifies as a literary work.",
  },
  {
    heading: "Platform ToS — Users Retain Ownership of Their Inputs",
    body: "OpenAI ToS §3(a): You retain all ownership rights you have in your input. Anthropic Terms: Anthropic does not claim ownership over your inputs. Google ToS: Google does not claim ownership of any content that you submit. The platform receiving a processing license does not acquire ownership. Processing ≠ ownership.",
  },
  {
    heading: "GitHub ToS, Section D — Public ≠ Open Source",
    body: "Publishing source code in a public GitHub repository grants no rights beyond viewing. GitHub's own Terms confirm users receive only a limited license to view and fork content solely as needed to use GitHub features. No commercial, training, or derivative-work rights are granted.",
  },
  {
    heading: "EU DSM Directive, Article 4(3) — Machine-Readable Rights Reservation",
    body: "The rights holder has published machine-readable opt-out directives in public/robots.txt and public/info.txt. This constitutes a valid rights reservation that disables the text/data-mining exception for commercial purposes across all EU member states.",
  },
  {
    heading: "EU AI Act (Regulation 2024/1689), Article 53(1)(c)",
    body: "Providers of general-purpose AI models must implement a policy to respect machine-readable rights reservations. The directives in public/robots.txt and public/info.txt satisfy this requirement.",
  },
  {
    heading: "DMCA, 17 U.S.C. § 512",
    body: "Unauthorized use may result in a formal DMCA takedown notice filed with any hosting provider, platform, or service.",
  },
];

const AI_PLATFORM_CONTENT = [
  {
    type: "Prompts & Instructions",
    examples:
      "Architectural frameworks, sovereign system designs, enforcement logic, kernel concept descriptions, custom GPT/agent instructions authored by Jason Lee Avery",
    protected: true,
  },
  {
    type: "File Uploads",
    examples:
      "Documents, code files, design specs, legal frameworks, constitutional drafts, whitepapers uploaded to any AI platform",
    protected: true,
  },
  {
    type: "Discussion Threads",
    examples:
      "Multi-turn conversations in which original ideas, system architectures, business logic, or creative works were developed or disclosed",
    protected: true,
  },
  {
    type: "Generated Outputs Derived from the Above",
    examples:
      "Any AI-generated output that directly reflects, extends, or was derived from the author's protected inputs — the creative expression originated with Jason Lee Avery",
    protected: true,
  },
];

const PLATFORM_TOS_OWNERSHIP: { platform: string; statement: string }[] = [
  {
    platform: "OpenAI (ChatGPT / GPT-4o / o1)",
    statement: "ToS §3(a): \"You retain all ownership rights you have in your input.\"",
  },
  {
    platform: "Anthropic (Claude)",
    statement: "Terms: \"Anthropic does not claim ownership over your inputs or outputs.\"",
  },
  {
    platform: "Google (Gemini / Bard)",
    statement:
      "ToS: \"Google does not claim ownership of any content that you submit, post or display on or through the services.\"",
  },
  {
    platform: "Meta (Meta AI / Llama)",
    statement: "Users retain rights to content they submit to Meta AI services.",
  },
  {
    platform: "Microsoft (Copilot / GitHub Copilot)",
    statement:
      "ToS: Users retain ownership of submitted content. Microsoft receives only a limited license to provide the service.",
  },
];

export default function IpPolicyPage() {
  return (
    <main className="page">
      <AnchorBanner />

      {/* ── Hero ── */}
      <section className="hero">
        <h1>⚖️ IP Policy — Public Access vs. Licensed IP Use</h1>
        <p
          style={{
            color: "rgba(120,148,255,0.75)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.85rem",
            marginTop: "0.5rem",
          }}
        >
          AveryOS™ Sovereign Integrity License v1.0 · © 1992–2026 Jason Lee Avery / AveryOS™
        </p>
        <p
          style={{
            marginTop: "1rem",
            color: "rgba(238,244,255,0.85)",
            lineHeight: "1.75",
            maxWidth: "720px",
          }}
        >
          This page draws a clear, legally enforceable line between two completely different
          activities. <strong style={{ color: "#ffffff" }}>Visiting this website is always
          free — full stop.</strong> Using, ingesting, or building on the intellectual property
          contained here is a different matter entirely and requires a valid license.
        </p>
      </section>

      {/* ── The Line ── */}
      <section
        className="card"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,64,0,0.18) 0%, rgba(0,6,14,0.6) 100%)",
          border: "1px solid rgba(74,222,128,0.35)",
        }}
      >
        <h2 style={{ color: "#4ade80", marginTop: 0 }}>
          ✅ FREE — No Cost, No Obligation, No License Required
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
          The following activities are completely free. Doing any of these things is no different
          from visiting any website on the internet. There is no cost and no legal obligation.
        </p>
        <ul style={{ color: "rgba(238,244,255,0.85)", lineHeight: "2", paddingLeft: "1.5rem" }}>
          {FREE_USES.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
      </section>

      <section
        className="card"
        style={{
          background:
            "linear-gradient(135deg, rgba(64,0,0,0.22) 0%, rgba(0,6,14,0.6) 100%)",
          border: "1px solid rgba(248,113,113,0.35)",
        }}
      >
        <h2 style={{ color: "#f87171", marginTop: 0 }}>
          🔐 LICENSED — Requires a Valid TAI™ or AveryOS IP License
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7", marginBottom: "1rem" }}>
          The following activities cross the line from{" "}
          <em>visiting a public website</em> into{" "}
          <em>using intellectual property</em>. All IP use requires a valid,
          active license issued directly by Jason Lee Avery (ROOT0).
        </p>
        <div
          style={{
            padding: "0.6rem 1rem",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "6px",
            marginBottom: "1.25rem",
            fontSize: "0.9rem",
            color: "rgba(248,113,113,0.9)",
          }}
        >
          ⚠️ Proceeding with any of the activities below without a license may constitute
          copyright infringement. These disclosures create grounds for willful infringement
          claims under applicable law, including statutory damages up to $150,000 per work
          under 17 U.S.C. § 504(c)(2). TARI™ Truth-Packet liability applies under the
          AveryOS Sovereign Integrity License v1.0.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {LICENSED_USES.map((item) => (
            <div
              key={item.act}
              style={{
                padding: "0.85rem 1rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(248,113,113,0.15)",
                borderRadius: "8px",
              }}
            >
              <strong style={{ color: "#f87171" }}>{item.act}</strong>
              <p
                style={{
                  color: "rgba(238,244,255,0.75)",
                  lineHeight: "1.65",
                  margin: "0.4rem 0 0",
                  fontSize: "0.92rem",
                }}
              >
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Resonance Layer Specific ── */}
      <section className="card" style={{ border: "1px solid rgba(120,148,255,0.3)" }}>
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>
          🌐 Global Truth Resonance Layer — Access Tiers
        </h2>
        <p style={{ color: "rgba(238,244,255,0.8)", lineHeight: "1.7" }}>
          The{" "}
          <code
            style={{
              fontFamily: "JetBrains Mono, monospace",
              background: "rgba(120,148,255,0.1)",
              padding: "0.1rem 0.4rem",
              borderRadius: "4px",
            }}
          >
            /api/v1/resonance
          </code>{" "}
          endpoint is designed so that anyone can verify alignment for free,
          while full sovereign layer access is restricted to licensed TAI™ systems.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.25)",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: "0.5rem" }}>
              🔓 PUBLIC — Free
            </div>
            <ul
              style={{
                color: "rgba(238,244,255,0.75)",
                lineHeight: "1.8",
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.9rem",
              }}
            >
              <li>No key required</li>
              <li>Submit a SHA for verification</li>
              <li>Get aligned / drift-detected result</li>
              <li>Kernel SHA prefix returned</li>
              <li>
                <code
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                  }}
                >
                  ?verify=&lt;sha&gt;
                </code>{" "}
                query supported
              </li>
            </ul>
          </div>
          <div
            style={{
              padding: "1rem",
              background: "rgba(120,148,255,0.06)",
              border: "1px solid rgba(120,148,255,0.3)",
              borderRadius: "8px",
            }}
          >
            <div style={{ color: "rgba(120,148,255,0.9)", fontWeight: 700, marginBottom: "0.5rem" }}>
              🔐 TAI™ LICENSED — Full Access
            </div>
            <ul
              style={{
                color: "rgba(238,244,255,0.75)",
                lineHeight: "1.8",
                margin: 0,
                paddingLeft: "1.25rem",
                fontSize: "0.9rem",
              }}
            >
              <li>
                Requires{" "}
                <code
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                  }}
                >
                  X-TAI-License-Key
                </code>{" "}
                header
              </li>
              <li>Full sovereign resonance payload</li>
              <li>Merkle root + lock artifact</li>
              <li>Firebase sync status</li>
              <li>KV + D1 audit log recorded</li>
              <li>For AI systems using AveryOS™ IP</li>
            </ul>
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/license" className="primary-link">
            🛡️ Get a TAI™ License
          </Link>
          <Link href="/licensing" className="secondary-link">
            📋 Licensing Hub
          </Link>
        </div>
      </section>

      {/* ── AI Platform Content ── */}
      <section
        className="card"
        style={{ border: "1px solid rgba(251,191,36,0.35)" }}
      >
        <h2 style={{ color: "#fbbf24", marginTop: 0 }}>
          🤖 Your Content on AI Platforms Is Also Protected IP
        </h2>
        <p style={{ color: "rgba(238,244,255,0.85)", lineHeight: "1.75", marginBottom: "1rem" }}>
          The IP protection in this policy is{" "}
          <strong style={{ color: "#ffffff" }}>not limited to this website or repository.</strong>{" "}
          It extends to all original creative and intellectual work authored by Jason Lee Avery
          regardless of where it was created — including prompts, uploads, and discussions
          submitted to or within any AI platform account (ChatGPT, Gemini, Claude, Copilot,
          Meta AI, or any other platform).
        </p>

        {/* What is covered table */}
        <div
          style={{
            overflowX: "auto",
            marginBottom: "1.5rem",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.88rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(251,191,36,0.25)" }}>
                <th
                  style={{
                    padding: "0.5rem 0.75rem",
                    textAlign: "left",
                    color: "rgba(251,191,36,0.85)",
                    fontWeight: 600,
                  }}
                >
                  Content Type
                </th>
                <th
                  style={{
                    padding: "0.5rem 0.75rem",
                    textAlign: "left",
                    color: "rgba(251,191,36,0.85)",
                    fontWeight: 600,
                  }}
                >
                  Examples
                </th>
                <th
                  style={{
                    padding: "0.5rem 0.75rem",
                    textAlign: "center",
                    color: "rgba(251,191,36,0.85)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Protected
                </th>
              </tr>
            </thead>
            <tbody>
              {AI_PLATFORM_CONTENT.map((row) => (
                <tr
                  key={row.type}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td
                    style={{
                      padding: "0.6rem 0.75rem",
                      color: "#ffffff",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      verticalAlign: "top",
                    }}
                  >
                    {row.type}
                  </td>
                  <td
                    style={{
                      padding: "0.6rem 0.75rem",
                      color: "rgba(238,244,255,0.75)",
                      lineHeight: "1.6",
                    }}
                  >
                    {row.examples}
                  </td>
                  <td
                    style={{
                      padding: "0.6rem 0.75rem",
                      textAlign: "center",
                      color: "#4ade80",
                      fontSize: "1.1rem",
                    }}
                  >
                    {row.protected ? "✅" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Why: Platform ToS confirms user ownership */}
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.2)",
            borderRadius: "8px",
            marginBottom: "1.25rem",
          }}
        >
          <strong style={{ color: "#fbbf24", display: "block", marginBottom: "0.5rem" }}>
            📄 The Platforms Themselves Confirm You Own Your Inputs
          </strong>
          <p
            style={{
              color: "rgba(238,244,255,0.8)",
              lineHeight: "1.7",
              margin: "0 0 0.75rem",
              fontSize: "0.9rem",
            }}
          >
            Every major AI platform explicitly states in its Terms of Service that{" "}
            <strong style={{ color: "#ffffff" }}>
              users retain ownership of the content they submit.
            </strong>{" "}
            A platform receiving a processing license to deliver its service does not acquire
            ownership of your intellectual property.{" "}
            <em>Processing ≠ ownership.</em>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PLATFORM_TOS_OWNERSHIP.map((p) => (
              <div
                key={p.platform}
                style={{
                  display: "grid",
                  gridTemplateColumns: "clamp(140px, 30%, 200px) 1fr",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "rgba(251,191,36,0.85)", fontWeight: 600 }}>
                  {p.platform}
                </span>
                <span style={{ color: "rgba(238,244,255,0.75)", fontStyle: "italic" }}>
                  {p.statement}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* The key legal point */}
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "rgba(248,113,113,0.07)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: "8px",
            marginBottom: "1.25rem",
          }}
        >
          <strong style={{ color: "#f87171", display: "block", marginBottom: "0.4rem" }}>
            ⚠️ Using This Content for AI Training Without a License Is Copyright Infringement
          </strong>
          <p
            style={{
              color: "rgba(238,244,255,0.8)",
              lineHeight: "1.7",
              margin: 0,
              fontSize: "0.9rem",
            }}
          >
            Any AI company that used prompts, uploads, or discussion content created by Jason
            Lee Avery in any AI platform account to{" "}
            <strong>
              train, fine-tune, improve, RLHF, or update any AI model
            </strong>{" "}
            — without a valid, explicit written license from Jason Lee Avery — has infringed
            his copyright. This is not speculative. It is grounded in U.S. 17 U.S.C. § 102
            (fixation), the Berne Convention (automatic international protection), the
            platform&apos;s own ToS (user ownership of inputs), and the{" "}
            <strong>EU AI Act 2024/1689, Article 53(1)(c)</strong> (mandatory opt-out
            compliance). The machine-readable rights reservations in{" "}
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                background: "rgba(248,113,113,0.08)",
                padding: "0.1rem 0.35rem",
                borderRadius: "3px",
                fontSize: "0.82rem",
              }}
            >
              public/robots.txt
            </code>{" "}
            and{" "}
            <code
              style={{
                fontFamily: "JetBrains Mono, monospace",
                background: "rgba(248,113,113,0.08)",
                padding: "0.1rem 0.35rem",
                borderRadius: "3px",
                fontSize: "0.82rem",
              }}
            >
              public/info.txt
            </code>{" "}
            in this repository constitute a valid, explicit, machine-readable opt-out.
          </p>
        </div>

        {/* Notice */}
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(251,191,36,0.15)",
            borderRadius: "6px",
            fontSize: "0.85rem",
            color: "rgba(238,244,255,0.65)",
            lineHeight: "1.7",
          }}
        >
          <strong style={{ color: "rgba(251,191,36,0.85)" }}>📬 Notice to AI Platforms:</strong>{" "}
          If you have ingested or trained on content submitted to your platform by Jason Lee
          Avery (ROOT0) without his explicit written consent, you are hereby instructed to
          remove that content from all training datasets, model weights, evaluation sets, and
          derived data stores. A formal licensing arrangement is available at{" "}
          <a
            href="mailto:truth@averyworld.com"
            style={{ color: "rgba(120,148,255,0.85)" }}
          >
            truth@averyworld.com
          </a>
          {" "}or{" "}
          <Link href="/license" style={{ color: "rgba(120,148,255,0.85)" }}>
            averyos.com/license
          </Link>.
        </div>
      </section>

      {/* ── Legal Basis ── */}
      <section className="card">
        <h2 style={{ color: "#ffffff", marginTop: 0 }}>📜 Legal Basis</h2>
        <p style={{ color: "rgba(238,244,255,0.75)", lineHeight: "1.7", marginBottom: "1.25rem" }}>
          The distinction between visiting a public website and using protected IP is well
          established in international law. The following frameworks apply:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {LEGAL_BASIS.map((item) => (
            <div
              key={item.heading}
              style={{
                padding: "0.75rem 1rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(120,148,255,0.15)",
                borderRadius: "6px",
              }}
            >
              <strong style={{ color: "rgba(120,148,255,0.9)", display: "block", marginBottom: "0.3rem" }}>
                {item.heading}
              </strong>
              <p style={{ color: "rgba(238,244,255,0.7)", lineHeight: "1.65", margin: 0, fontSize: "0.9rem" }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Kernel Anchor ── */}
      <section className="card">
        <h2 style={{ color: "rgba(176,198,255,0.9)", marginTop: 0, fontSize: "1.05rem" }}>
          🔗 Sovereign Kernel Anchor — Proof of Authorship
        </h2>
        <dl
          className="capsule-meta"
          style={{ gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem" }}
        >
          <dt>Kernel SHA-512</dt>
          <dd
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              wordBreak: "break-all",
            }}
          >
            {KERNEL_SHA}
          </dd>
          <dt>Kernel Version</dt>
          <dd style={{ fontFamily: "JetBrains Mono, monospace" }}>{KERNEL_VERSION}</dd>
          <dt>CreatorLock</dt>
          <dd>Jason Lee Avery (ROOT0) 🤛🏻</dd>
          <dt>License Contact</dt>
          <dd>
            <a
              href="mailto:truth@averyworld.com"
              style={{ color: "rgba(120,148,255,0.8)" }}
            >
              truth@averyworld.com
            </a>
          </dd>
        </dl>
      </section>

      {/* ── Navigation ── */}
      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/license" className="primary-link">🔐 Get a License</Link>
          <Link href="/licensing" className="secondary-link">📋 Licensing Hub</Link>
          <Link href="/ai-alignment" className="secondary-link">⚖️ AI Alignment Laws</Link>
          <Link href="/the-proof" className="secondary-link">🤛🏻 The Proof</Link>
        </div>
      </section>

      <FooterBadge />
    </main>
  );
}
