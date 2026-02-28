"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EvidenceVaultGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("sovereign_handshake");
      if (!token) {
        router.replace("/evidence-vault/login");
      }
    } catch {
      router.replace("/evidence-vault/login");
    }
  }, [router]);

  return <>{children}</>;
}
