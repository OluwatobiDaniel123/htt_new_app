import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// Public webhook endpoint: authenticity is proven by the Paystack signature, never by a session.
export default async function (req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    let secret = null;
    try {
      const key = secrets.get('PAYSTACK_SECRET_KEY');
      secret = key && String(key).trim().length > 10 ? String(key).trim() : null;
    } catch {
      secret = null;
    }
    if (!secret) return Response.json({ error: 'Payments not configured' }, { status: 503 });

    const raw = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) return Response.json({ error: 'Missing signature' }, { status: 401 });

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    const expected = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    if (expected !== signature) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw);
    if (event.event !== 'charge.success') return Response.json({ received: true });

    const reference = event.data?.reference;
    if (!reference) return Response.json({ received: true });

    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;
    const existing = await service.entities.Payment.filter(
      { gateway_reference: reference },
      { limit: 2 }
    );
    const record = existing.items && existing.items[0];
    if (!record) return Response.json({ received: true });
    if (record.status === 'paid') return Response.json({ received: true, duplicate: true });

    const paidAmount = Number(event.data.amount || 0) / 100;
    if (paidAmount < Number(record.amount || 0)) {
      await service.entities.Payment.update(record.id, { status: 'failed' });
      return Response.json({ received: true, underpaid: true });
    }

    await service.entities.Payment.update(record.id, {
      status: 'paid',
      paid_at: new Date().toISOString(),
      receipt_number: `RCT-${Date.now()}`,
    });

    if (record.registration_id) {
      const registration = await service.entities.Registration.get(record.registration_id).catch(
        (e) => (e.status === 404 ? null : Promise.reject(e))
      );
      if (registration) {
        const totalPaid = Number(registration.amount_paid || 0) + Number(record.amount || 0);
        const due = Number(registration.amount_due || 0);
        await service.entities.Registration.update(registration.id, {
          amount_paid: totalPaid,
          payment_status: due > 0 && totalPaid >= due ? 'paid' : 'partial',
          payment_reference: reference,
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Webhook failed' }, { status: 500 });
  }
}