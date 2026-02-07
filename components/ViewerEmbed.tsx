import React from "react";

type ViewerEmbedProps = {
  viewerUrl?: string | null;
};

const ViewerEmbed: React.FC<ViewerEmbedProps> = ({ viewerUrl }) => {
  return (
    <div className="badge">
      <h3>Viewer+</h3>
      {viewerUrl ? (
        <a className="badge-link" href={viewerUrl} target="_blank" rel="noreferrer">
          Open Viewer+
        </a>
      ) : (
        <p>Awaiting Viewer+ endpoint.</p>
      )}
      <p>{viewerUrl ? `Connected: ${viewerUrl}` : "Awaiting Viewer+ endpoint."}</p>
    </div>
  );
};

export default ViewerEmbed;
