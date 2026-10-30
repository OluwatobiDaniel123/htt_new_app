import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const ALLOWED_ROLES = ['admin', 'ceo', 'finance', 'operations'];

const readSecret = () => {
  try {
    const key = secrets.get('PAYSTACK_SECRET_KEY');
    return key && String(key).trim().length > 10 ? String(key).trim() : null;
  } catch {
    return null;
  }
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth
      .me()
      .catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role)) {
      return Response.json({ error: 'Your role cannot process payments' }, { status: 403 });
    }

    const secret = readSecret();
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'initiate';

    if (!secret) {
      return Response.json({
        configured: false,
        message:
          'Paystack is not configured. Add the PAYSTACK_SECRET_KEY secret to enable online payments.',
      });
    }

    if (action === 'initiate') {
      if (!body.registrationId) {
        return Response.json({ error: 'registrationId is required' }, { status: 400 });
      }
      // Amount is always derived server-side from the registration record.
      const registration = await base44.entities.Registration.get(body.registrationId).catch((e) =>
        e.status === 404 ? null : Promise.reject(e)
      );
      if (!registration) return Response.json({ error: 'Registration not found' }, { status: 404 });

      const outstanding = Number(registration.amount_due || 0) - Number(registration.amount_paid || 0);
      if (outstanding <= 0) {
        return Response.json({ error: 'Nothing outstanding on this registration' }, { status: 400 });
      }
      const email = registration.guardian_email;
      if (!email) {
        return Response.json({ error: 'The guardian has no email address on file' }, { status: 400 });
      }

      const reference = `HTT-${registration.id.slice(0, 8)}-${Date.now()}`;
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: Math.round(outstanding * 100),
          currency: 'NGN',
          reference,
          metadata: { registrationId: registration.id, reference: registration.reference },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        return Response.json(
          { error: data.message || 'Paystack rejected the transaction' },
          { status: 502 }
        );
      }
      await base44.entities.Payment.create({
        reference,
        registration_id: registration.id,
        player_name: registration.child_name || '',
        payer_name: registration.guardian_name || email,
        amount: outstanding,
        currency: 'NGN',
        method: 'paystack',
        purpose: 'registration',
        status: 'pending',
        gateway_reference: reference,
      });
      return Response.json({
        configured: true,
        authorizationUrl: data.data.authorization_url,
        reference,
        amount: outstanding,
      });
    }

    if (action === 'verify') {
      const reference = body.reference;
      if (!reference) return Response.json({ error: 'reference is required' }, { status: 400 });
      const existing = await base44.entities.Payment.filter(
        { gateway_reference: reference },
        { limit: 5 }
      );
      const record = existing.items && existing.items[0];

      const res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(15000),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.status) {
        return Response.json({ error: data.message || 'Verification failed' }, { status: 502 });
      }
      const paid =
        data.data.status === 'success' && Number(data.data.amount) >= Math.round(Number(record?.amount || 0) * 100);
      if (!record) return Response.json({ error: 'Payment record not found' }, { status: 404 });
      if (record.status === 'paid') {
        return Response.json({ status: 'paid', alreadyProcessed: true });
      }
      if (!paid) {
        await base44.entities.Payment.update(record.id, { status: 'failed' });
        return Response.json({ status: 'failed' });
      }
      const stamp = Date.now();
      await base44.entities.Payment.update(record.id, {
        status: 'paid',
        paid_at: new Date().toISOString(),
        receipt_number: `RCT-${stamp}`,
      });
      if (record.registration_id) {
        const registration = await base44.entities.Registration.get(record.registration_id).catch(
          (e) => (e.status === 404 ? null : Promise.reject(e))
        );
        if (registration) {
          const totalPaid = Number(registration.amount_paid || 0) + Number(record.amount || 0);
          const due = Number(registration.amount_due || 0);
          await base44.entities.Registration.update(registration.id, {
            amount_paid: totalPaid,
            payment_status: due > 0 && totalPaid >= due ? 'paid' : 'partial',
            payment_reference: reference,
          });
        }
      }
      await base44.entities.AuditLog.create({
        actor_email: user.email || '',
        actor_name: user.full_name || user.email || '',
        action: 'verify_payment',
        entity_name: 'Payment',
        record_id: record.id,
        record_label: reference,
        details: 'Paystack transaction verified server-side',
      });
      return Response.json({ status: 'paid' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Payment processing failed' }, { status: 500 });
  }
}