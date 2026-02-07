import React from "react";

export type CapsuleBlockProps = {
  title: string;
  summary: string;
interface CapsuleBlockProps {
  sha: string;
  driftLock: string;
  vaultChainUrl?: string;
  capsuleId: string;
  licenseStatus: string;
  compiledAt?: string;
};

const CapsuleBlock: React.FC<CapsuleBlockProps> = ({
  title,
  summary,
}

const CapsuleBlock: React.FC<CapsuleBlockProps> = ({
  sha,
  driftLock,
  vaultChainUrl,
  capsuleId,
  licenseStatus,
  compiledAt,
}) => {
  const compiledAtLabel = compiledAt
    ? Number.isNaN(Date.parse(compiledAt))
      ? compiledAt
      : new Date(compiledAt).toLocaleString()
    : null;

  return (
    <section className="capsule-block">
      <header>
        <p className="capsule-kicker">Capsule • {capsuleId}</p>
        <h1>{title}</h1>
        <p className="capsule-summary">{summary}</p>
      </header>
      <dl className="capsule-meta">
        <div>
          <dt>SHA</dt>
          <dd>{sha}</dd>
        </div>
        <div>
          <dt>DriftLock</dt>
          <dd>{driftLock}</dd>
        </div>
        <div>
          <dt>VaultChain</dt>
          <dd>
            {vaultChainUrl ? (
              <a href={vaultChainUrl} target="_blank" rel="noreferrer">
                {vaultChainUrl}
              </a>
            ) : (
              "Pending"
            )}
          </dd>
        </div>
        <div>
          <dt>License Status</dt>
          <dd>{licenseStatus}</dd>
        </div>
        {compiledAtLabel ? (
          <div>
            <dt>Compiled At</dt>
            <dd>{compiledAtLabel}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  return (
    <div className="border border-gray-200 p-4 rounded-lg shadow-sm mb-4 bg-white">
      <h3 className="text-xl font-semibold mb-1">{capsuleId}</h3>
      <p className="text-sm text-gray-600 mb-1">
        <strong>SHA:</strong> {sha}
      </p>
      <p className="text-sm text-gray-600 mb-1">
        <strong>DriftLock:</strong> {driftLock}
      </p>
      {vaultChainUrl && (
        <p className="text-sm text-blue-600 underline mb-1">
          <a href={vaultChainUrl} target="_blank" rel="noopener noreferrer">
            VaultChain URL
          </a>
        </p>
      )}
      <p className="text-sm text-gray-600 mb-1">
        <strong>Status:</strong> {licenseStatus}
      </p>
      {compiledAt && (
        <p className="text-sm text-gray-500 italic">
          Compiled: {compiledAt}
        </p>
      )}
    </div>
  );
};

export default CapsuleBlock;
