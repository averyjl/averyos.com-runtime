/**
 * © 1992–2026 Jason Lee Avery / AveryOS™. All Rights Reserved.
 * Unauthorized use, duplication, or derivative work without express written
 * consent of the Creator and legal owner, Jason Lee Avery / AveryOS™, is prohibited.
 * Licensed under AveryOS™ Sovereign Integrity License v1.0.
 * Subject to CreatorLock™ and Sovereign Kernel Governance.
 * SHA-512 Kernel Anchor: cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e
 * (AveryOS_CopyrightBlock_v1.0) truth@averyworld.com
 */
import React from "react";

export type CapsuleBlockProps = {
  title: string;
  summary: string;
  sha: string;
  driftLock: string;
  vaultChainUrl?: string | null;
  capsuleId: string;
  licenseStatus: string;
  compiledAt?: string;
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
  );
};

export default CapsuleBlock;
