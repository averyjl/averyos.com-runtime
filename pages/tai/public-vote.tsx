import Head from "next/head";

const TaiPublicVotePage = () => {
  return (
    <>
      <Head>
        <title>TAI Public Vote Session</title>
      </Head>
      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>TAI Public Vote Session</h1>
          <p>Civic capsule vote mechanism for public governance alignment.</p>
        </section>
        <section className="card">
          <p>Vote module status: bootstrap mode.</p>
          <button type="button" className="primary-button">Open Civic Vote (Stub)</button>
        </section>
      </main>
    </>
  );
};

export default TaiPublicVotePage;
