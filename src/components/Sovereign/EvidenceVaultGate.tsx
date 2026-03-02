"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EvidenceVaultGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("sovereign_handshake");
      if (!token) {
        setIsAuthorized(false);
        router.replace("/evidence-vault/login");
      } else {
        setIsAuthorized(true);
      }
    } catch {
      setIsAuthorized(false);
      router.replace("/evidence-vault/login");
    }
  }, [router]);

  if (isAuthorized !== true) return null;
  return <>{children}</>;
}
