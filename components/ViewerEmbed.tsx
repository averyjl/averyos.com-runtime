import React from "react";

type ViewerEmbedProps = {
  viewerUrl?: string | null;
};

const ViewerEmbed: React.FC<ViewerEmbedProps> = ({ viewerUrl }) => {
  return (
    <div className="badge">
      <h3>Viewer+</h3>
      <p>{viewerUrl ? `Connected: ${viewerUrl}` : "Awaiting Viewer+ endpoint."}</p>
    </div>
  );
};

export default ViewerEmbed;
