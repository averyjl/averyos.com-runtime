export default function ViewerEmbed({ 
  src, 
  viewerUrl, 
  title = "VaultViewer" 
}: { 
  src?: string; 
  viewerUrl?: string | null; 
  title?: string;
}) {
  const url = src || viewerUrl;
  
  if (!url) {
    return (
      <div className="badge">
        <h3>Viewer+</h3>
        <p>Awaiting Viewer+ endpoint.</p>
      </div>
    );
  }
  
  return (
    <iframe
      src={url}
      className="w-full h-[80vh] border rounded shadow-xl"
      title={title}
    />
  );
}
