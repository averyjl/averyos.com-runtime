export default function CapsuleDiff() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">🔁 Capsule Diff Visualizer</h1>
      <p className="mt-2">View and compare historical capsule SHA snapshots here.</p>
      <iframe
        src="/VaultBridge/sha_snapshot.log"
        className="w-full h-[80vh] border mt-4 font-mono bg-black text-white"
      />
    </div>
  );
}
