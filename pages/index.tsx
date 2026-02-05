import Head from "next/head";
import LicenseContent from "../components/LicenseContent";
import { getSiteUrl } from "../lib/siteConfig";

const Home = () => {
  const siteUrl = getSiteUrl();

  return (
    <>
      <Head>
        <title>AveryOS License • Public Validation</title>
        <meta
          name="description"
          content="Public license validation and terms for AveryOS Sovereign Integrity License v1.0."
        />
        <meta property="og:title" content="AveryOS License • Public Validation" />
        <meta
          property="og:description"
          content="Public license validation and terms for AveryOS Sovereign Integrity License v1.0."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <link rel="canonical" href={siteUrl} />
      </Head>
      <LicenseContent />
    </>
  );
};

export default Home;
