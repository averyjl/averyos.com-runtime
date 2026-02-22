import type { NextPage } from "next";
import { useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const MobilePulsePage: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/vault/vaultchain-status");
  }, [router]);

  return (
    <>
      <Head>
        <title>VaultChain Status • AveryOS</title>
        <meta httpEquiv="refresh" content="0;url=/vault/vaultchain-status" />
      </Head>
      <main className="page">
        <p style={{ color: "rgba(238,244,255,0.7)", textAlign: "center", padding: "2rem" }}>
          ⚓ Redirecting to VaultChain Status...
        </p>
      </main>
    </>
  );
};

export default MobilePulsePage;
