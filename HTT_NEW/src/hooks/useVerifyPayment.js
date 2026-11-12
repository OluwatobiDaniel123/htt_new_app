import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';

export default function useVerifyPayment() {
  /** @type {(reference: string) => Promise<unknown>} */
  const mutationFn = (reference) =>
    api.post(`/payments/verify/${encodeURIComponent(reference)}`, {});

  return useMutation({
    mutationFn,
  });
}
