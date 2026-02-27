import { useEffect } from "react";
import { useRouter } from "next/router";

// /buy is now consolidated into /license
const BuyPage = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/license");
  }, [router]);
  return null;
};

export default BuyPage;
