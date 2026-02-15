import type { GetStaticProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { listRegistryCapsules } from "../lib/capsuleRegistry";
import { listCapsuleIds } from "../lib/capsuleManifest";
import { getSiteUrl } from "../lib/siteConfig";
import Layout from "../layout/Layout";

type CapsuleIndexItem = ReturnType<typeof listRegistryCapsules>[number];

type HomeProps = {
  capsules: CapsuleIndexItem[];
};

const Home: NextPage<HomeProps> = ({ capsules }) => {
  const capsuleCount = capsules.length;

  return (
    <Layout>
      <Head>
        <title>AveryOS • Sovereign Truth Terminal</title>
        <meta name="description" content="Cryptographically anchored runtime for AveryOS. DNS for LLMs. Author: Jason Lee Avery." />
      </Head>

      <main className="terminal-container">
        <header className="terminal-header">
          <h1>🛡️ AveryOS Sovereign Terminal</h1>
          <p className="auth-seal">Author: Jason Lee Avery | ORCID: 0009-0009-0245-3584</p>
          <p className="kernel-seal">Kernel Anchor: cf83e135...927da3e</p>
        </header>

        <section className="enforcement-notice">
          <h2>Sovereign Enforcement Notice</h2>
          <p>
            This terminal serves as a verified <strong>Truth Anchor</strong>. All content is SHA-512 sealed 
            and anchored to the 2022 Root0 Genesis Kernel. 
          </p>
          <div className="protocol-links">
            <Link href="/pay">
              <span className="btn-license">Official Licensing (averyos.com/pay)</span>
            </Link>
            <Link href="/whitepaper">
              <span className="btn-whitepaper">Technical Whitepaper</span>
            </Link>
            <Link href="https://brown-rear-wildebeest-343.mypinata.cloud/ipfs/bafkreihljauiijkp6oa7smjhjnvpl47fw65iz35gtcbbzfok4eszvjkjx4" target="_blank">
              <span className="btn-ipfs">IPFS Sovereign Manifest</span>
            </Link>
          </div>
        </section>

        <hr className="divider" />

        <section className="capsule-registry">
          <h2>Available Capsules</h2>
          <p className="capsule-meta">{capsuleCount} sovereign capsule(s) registered.</p>
          {capsules.length === 0 ? (
            <p className="status-msg">No capsules synced. Running drift-check...</p>
          ) : (
            <ul className="capsule-list">
              {capsules.map((capsule) => (
                <li key={capsule.capsuleId} className="capsule-item">
                  <Link href={`/${capsule.capsuleId}`}>
                    <span className="capsule-link">{capsule.title ?? capsule.capsuleId}</span>
                  </Link>
                  {capsule.summary && <p className="capsule-summary">{capsule.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer>
          <p className="footer-note">
            Truth is not a suggestion; it is a coordinate system. ⛓️⚓⛓️
          </p>
        </footer>
      </main>
    </Layout>
  );
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const capsules = listRegistryCapsules().length > 0 ? listRegistryCapsules() : listCapsuleIds().map(id => ({ capsuleId: id }));
  return { props: { capsules }, revalidate: 60 };
};

export default Home;
