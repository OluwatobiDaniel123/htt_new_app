import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import useVerifyPayment from '@/hooks/useVerifyPayment';

const statusMessage = (status) => {
  if (status === 'successful') return 'Payment confirmed';
  if (status === 'pending') return 'Payment is still pending';
  if (status === 'cancelled' || status === 'expired') return 'Payment was not completed';
  if (status === 'failed') return 'Payment failed';
  return 'Payment could not be confirmed';
};

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const attemptedReference = useRef(null);
  const verification = useVerifyPayment();

  useEffect(() => {
    if (reference && attemptedReference.current !== reference) {
      attemptedReference.current = reference;
      verification.mutate(reference);
    }
  }, [reference, verification.mutate]);

  const result = verification.data;
  const status = result && typeof result === 'object' && 'status' in result && typeof result.status === 'string'
    ? result.status
    : undefined;
  const confirmed = status === 'successful';
  const message = verification.isPending
    ? 'Verifying your payment with Paystack…'
    : verification.isError
      ? 'Payment could not be confirmed. Please contact the academy with your payment reference.'
      : statusMessage(status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{confirmed ? 'Payment confirmed' : 'Payment status'}</h1>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {!reference
            ? 'A payment reference was not provided. Please contact the academy.'
            : message}
        </p>
        {reference ? <p className="break-all text-xs text-muted-foreground">Reference: {reference}</p> : null}
        {(verification.data || verification.isError) && !confirmed && reference ? (
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm"
            onClick={() => verification.mutate(reference)}
            disabled={verification.isPending}
          >
            Check again
          </button>
        ) : null}
      </section>
    </main>
  );
}
