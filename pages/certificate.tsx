export default function CertificateViewer() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">🧾 Certificate Viewer</h1>
      <iframe
        src="/VaultBridge/VaultProof_DriftShield_v4-CapsuleLineage.pdf"
        className="w-full h-[80vh] border mt-4"
      />
    </div>
  );
}
