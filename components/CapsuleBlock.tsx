import React from "react";

export type CapsuleBlockProps = {
  title: string;
  summary: string;
  sha: string;
  driftLock: string;
  vaultChainUrl?: string;
  capsuleId: string;
  licenseStatus: string;
  compiledAt?: string;
  vaultChainUrl?: string;
  capsuleId: string;
};

const CapsuleBlock: React.FC<CapsuleBlockProps> = ({
  title,
  summary,
  sha,
  driftLock,
  vaultChainUrl,
  capsuleId,
  licenseStatus,
  compiledAt,
  vaultChainUrl,
  capsuleId,
}) => {
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
        {compiledAt ? (
          <div>
            <dt>Compiled At</dt>
            <dd>{new Date(compiledAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
};

export default CapsuleBlock;
