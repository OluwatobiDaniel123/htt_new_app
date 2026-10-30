import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const ALLOWED_ROLES = ['admin', 'ceo', 'operations'];

const ageGroupFromDob = (dob) => {
  if (!dob) return '';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '';
  const age = Math.floor((Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  if (age <= 10) return '8-10';
  if (age <= 12) return '11-12';
  if (age <= 14) return '13-14';
  return 'other';
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth
      .me()
      .catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role)) {
      return Response.json({ error: 'Your role cannot approve registrations' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const registrationId = body.registrationId;
    const note = typeof body.note === 'string' ? body.note.slice(0, 1000) : '';
    if (!registrationId) return Response.json({ error: 'registrationId is required' }, { status: 400 });

    const registration = await base44.entities.Registration.get(registrationId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e)
    );
    if (!registration) return Response.json({ error: 'Registration not found' }, { status: 404 });
    if (registration.status === 'rejected') {
      return Response.json({ error: 'A rejected registration cannot be approved' }, { status: 400 });
    }
    if (registration.linked_player_id) {
      return Response.json({
        playerId: registration.linked_player_id,
        created: false,
        alreadyApproved: true,
      });
    }

    const now = new Date().toISOString();

    // Duplicate prevention: reuse an existing player with the same name and date of birth.
    const existing = await base44.entities.Player.filter(
      { full_name: registration.child_name, date_of_birth: registration.child_date_of_birth },
      { limit: 5 }
    );
    let player = existing.items && existing.items.length > 0 ? existing.items[0] : null;
    let created = false;

    if (!player) {
      player = await base44.entities.Player.create({
        player_id: `HTT-P-${Date.now().toString().slice(-6)}`,
        full_name: registration.child_name,
        date_of_birth: registration.child_date_of_birth,
        age_group: registration.age_group || ageGroupFromDob(registration.child_date_of_birth),
        centre_id: registration.centre_id || '',
        centre_name: registration.centre_name || '',
        programme_id: registration.programme_id || '',
        programme_name: registration.programme_name || '',
        registration_status: 'registered',
        scholarship_status:
          registration.pathway === 'scholarship_assessment' ? 'applicant' : 'none',
        document_verification: registration.document_status === 'verified' ? 'verified' : 'pending',
        primary_guardian_name: registration.guardian_name || '',
        registration_id: registration.id,
        match_appearances: 0,
      });
      created = true;
    } else if (!player.centre_id && registration.centre_id) {
      await base44.entities.Player.update(player.id, {
        centre_id: registration.centre_id,
        centre_name: registration.centre_name || '',
      });
    }

    // Guardian record and link
    if (registration.guardian_name) {
      const guardianMatches = registration.guardian_phone
        ? await base44.entities.Guardian.filter({ phone: registration.guardian_phone }, { limit: 2 })
        : { items: [] };
      let guardian = guardianMatches.items && guardianMatches.items[0];
      if (!guardian) {
        guardian = await base44.entities.Guardian.create({
          full_name: registration.guardian_name,
          phone: registration.guardian_phone || '',
          email: registration.guardian_email || '',
          address: registration.guardian_address || '',
          preferred_contact: 'phone',
          account_status: 'active',
          consent_status: registration.consent_data ? 'granted' : 'pending',
        });
      }
      const links = await base44.entities.GuardianLink.filter(
        { guardian_id: guardian.id, player_id: player.id },
        { limit: 1 }
      );
      if (!links.items || links.items.length === 0) {
        await base44.entities.GuardianLink.create({
          guardian_id: guardian.id,
          guardian_name: guardian.full_name,
          player_id: player.id,
          player_name: player.full_name,
          relationship: 'guardian',
          is_primary: true,
          is_emergency_contact: true,
        });
      }
      const playerGuardians = Array.isArray(player.guardian_ids) ? player.guardian_ids : [];
      if (!playerGuardians.includes(guardian.id)) {
        await base44.entities.Player.update(player.id, {
          guardian_ids: [...playerGuardians, guardian.id],
        });
      }
    }

    // Consent records captured from the registration form
    const consents = [
      ['media_photography', registration.consent_media],
      ['data_processing', registration.consent_data],
      ['medical', registration.consent_medical],
    ];
    for (const [consentType, granted] of consents) {
      if (!granted) continue;
      await base44.entities.ConsentRecord.create({
        subject_type: 'player',
        player_id: player.id,
        player_name: player.full_name,
        consent_type: consentType,
        status: 'granted',
        granted_at: now.slice(0, 10),
        notes: 'Captured during registration approval',
      });
    }

    const history = Array.isArray(registration.status_history) ? registration.status_history : [];
    await base44.entities.Registration.update(registrationId, {
      status: 'approved',
      linked_player_id: player.id,
      reviewed_at: now,
      assigned_reviewer: registration.assigned_reviewer || user.email,
      status_history: [
        ...history,
        {
          status: 'approved',
          note: note || 'Registration approved and player record provisioned',
          at: now,
          by: user.email,
        },
      ],
    });

    await base44.entities.AuditLog.create({
      actor_email: user.email || '',
      actor_name: user.full_name || user.email || '',
      action: 'approve',
      entity_name: 'Registration',
      record_id: registrationId,
      record_label: registration.reference || registration.child_name || '',
      details: created
        ? `Player record ${player.player_id} created from registration`
        : `Existing player record ${player.player_id} linked`,
    });

    return Response.json({ playerId: player.id, playerCode: player.player_id, created });
  } catch (error) {
    return Response.json({ error: error.message || 'Approval failed' }, { status: 500 });
  }
}