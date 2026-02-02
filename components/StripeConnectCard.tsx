import React from "react";

type StripeConnectCardProps = {
  status: string;
  stripeUrl?: string | null;
};

const StripeConnectCard: React.FC<StripeConnectCardProps> = ({ status, stripeUrl }) => {
  return (
    <div className="badge">
      <h3>Stripe License</h3>
      <p>Status: {status}</p>
      {stripeUrl ? (
        <a className="badge-link" href={stripeUrl} target="_blank" rel="noreferrer">
          Open Stripe Portal
        </a>
      ) : (
        <p>Awaiting Stripe connection.</p>
      )}
      <p>{stripeUrl ? `Portal: ${stripeUrl}` : "Awaiting Stripe connection."}</p>
    </div>
  );
};

export default StripeConnectCard;
