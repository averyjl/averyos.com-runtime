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
      <p>{stripeUrl ? `Portal: ${stripeUrl}` : "Awaiting Stripe connection."}</p>
    </div>
  );
};

export default StripeConnectCard;
