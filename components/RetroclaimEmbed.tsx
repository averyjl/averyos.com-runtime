import React from "react";

type RetroclaimEmbedProps = {
  capsuleId: string;
  licenseStatus: string;
};

const RetroclaimEmbed: React.FC<RetroclaimEmbedProps> = ({ capsuleId, licenseStatus }) => {
  return (
    <div className="badge">
      <h3>Retroclaim Embed</h3>
      <p>Capsule: {capsuleId}</p>
      <p>Status: {licenseStatus}</p>
    </div>
  );
};

export default RetroclaimEmbed;
