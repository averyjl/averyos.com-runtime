import React from "react";

type CapsuleBodyProps = {
  body: string[];
};

const CapsuleBody: React.FC<CapsuleBodyProps> = ({ body }) => {
  if (body.length === 0) {
    return null;
  }

  return (
    <section className="capsule-body">
      {body.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 10)}`}>{paragraph}</p>
      ))}
    </section>
  );
};

export default CapsuleBody;
