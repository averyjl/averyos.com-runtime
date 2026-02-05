import React from "react";

interface CapsuleBlockProps {
  sha: string;
  driftLock: string;
  vaultChainUrl?: string;
  capsuleId: string;
  licenseStatus: string;
  compiledAt?: string;
}

const CapsuleBlock: React.FC<CapsuleBlockProps> = ({
  sha,
  driftLock,
  vaultChainUrl,
  capsuleId,
  licenseStatus,
  compiledAt,
}) => {
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
