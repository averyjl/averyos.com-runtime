import Head from "next/head";

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
          <p>Primary licensing route: <a href="/license">/license</a></p>
          <p>Witness registry route: <a href="/witness/register">/witness/register</a></p>
        </section>
      </main>
    </>
  );
};

export default CapsulesPage;
