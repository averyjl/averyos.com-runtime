export default function StripeOfferEmbed({ offerId }: { offerId: string }) {
  return (
    <iframe
      src={`https://checkout.stripe.com/pay/${offerId}`}
      width="100%"
      height="640"
      frameBorder="0"
    />
  );
}
