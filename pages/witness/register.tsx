import Head from "next/head";

const WitnessRegisterPage = () => {
  return (
    <>
      <Head>
        <title>AnchorWitness Registry</title>
      </Head>
      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>AnchorWitness Invite Form</h1>
          <p>Public registry entry portal for witness alignment.</p>
        </section>
        <section className="card">
          <div className="form-grid">
            <label>Name<input type="text" placeholder="Witness name" /></label>
            <label>Email<input type="email" placeholder="witness@example.com" /></label>
            <label>VaultSig (SHA512)<input type="text" placeholder="Paste SHA512 hash" /></label>
            <button type="button" className="primary-button">Submit Witness Entry (Stub)</button>
          </div>
        </section>
      </main>
    </>
  );
};

export default WitnessRegisterPage;
