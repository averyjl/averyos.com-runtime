import { useEffect } from "react";
import { useRouter } from "next/router";

// /pay is now consolidated into /license

const PayPage = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/license");
  }, [router]);
  return null;
};

export default PayPage;
