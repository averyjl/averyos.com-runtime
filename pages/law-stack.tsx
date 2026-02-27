import { useEffect } from "react";
import { useRouter } from "next/router";

// /law-stack has been renamed to /ai-alignment
const LawStackPage = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ai-alignment");
  }, [router]);
  return null;
};

export default LawStackPage;
