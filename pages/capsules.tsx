import Head from "next/head";
import Link from "next/link";

const CapsulesPage = () => {
  return (
    <>
      <Head>
        <title>AveryOS Capsule Store</title>
      </Head>
      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>Capsule Store</h1>
          <p>Public capsule access and licensing pathways for educators, collaborators, and authors.</p>
        </section>
        <section className="card">
          <p>Primary licensing route: <Link href="/license">/license</Link></p>
          <p>Witness registry route: <Link href="/witness/register">/witness/register</Link></p>
        </section>
      </main>
    </>
  );
};

export default CapsulesPage;
