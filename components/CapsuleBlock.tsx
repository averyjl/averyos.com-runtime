import React from "react";

export type CapsuleBlockProps = {
  title: string;
  summary: string;
  sha: string;
  vaultChainUrl?: string;
  capsuleId: string;
};

const CapsuleBlock: React.FC<CapsuleBlockProps> = ({
  title,
  summary,
  sha,
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
      </dl>
    </section>
  );
};

export default CapsuleBlock;
