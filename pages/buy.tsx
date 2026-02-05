import Head from "next/head";
import { getSiteUrl } from "../lib/siteConfig";

const stripeLink = "https://buy.stripe.com/7sYaEXf9G4hk8o2gkicMM01";

const BuyPage = () => {
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/buy`;

  return (
    <>
      <Head>
        <title>Buy AveryOS License</title>
        <meta
          name="description"
          content="Purchase or view AveryOS license access via secure Stripe checkout."
        />
        <meta property="og:title" content="Buy AveryOS License" />
        <meta
          property="og:description"
          content="Purchase or view AveryOS license access via secure Stripe checkout."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <link rel="canonical" href={pageUrl} />
      </Head>
      <main className="page">
        <section className="hero">
          <h1>Purchase AveryOS License</h1>
          <p>Secure payment is handled by Stripe. Your license will be issued on completion.</p>
          <a className="primary-link" href={stripeLink} target="_blank" rel="noreferrer">
            Open Stripe Checkout
          </a>
        </section>
        <section className="card">
          <h2>Need Help?</h2>
          <p>
            Contact <a href="mailto:truth@averyworld.com">truth@averyworld.com</a> for licensing
            support or invoice requests.
          </p>
        </section>
      </main>
    </>
  );
};

export default BuyPage;
