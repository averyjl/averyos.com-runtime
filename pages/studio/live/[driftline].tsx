import type { GetServerSideProps } from "next";
import Head from "next/head";

type Props = { driftline: string };

const StudioLivePage = ({ driftline }: Props) => {
  return (
    <>
      <Head>
        <title>Sovereign Studio Live • {driftline}</title>
      </Head>
      <main className="page truthnest-page">
        <section className="hero truthnest-hero">
          <h1>Sovereign Studio Live</h1>
          <p>Driftline session: {driftline}</p>
        </section>
        <section className="card">
          <p>Updated video walkthrough feed placeholder for the Sovereign Studio channel.</p>
        </section>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const driftline = typeof context.params?.driftline === "string" ? context.params.driftline : "driftline84";
  return { props: { driftline } };
};

export default StudioLivePage;
