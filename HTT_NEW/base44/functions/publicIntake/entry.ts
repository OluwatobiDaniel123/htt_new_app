import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Public, unauthenticated intake API for the separate HTT public website.
// Only explicitly whitelisted actions are reachable; nothing internal is returned.

const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
const hits = new Map();

const rateLimited = (req) => {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
};

const str = (value, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const publicCentre = (c) => ({
  id: c.id,
  name: c.name,
  code: c.code,
  area: c.area,
  address: c.address || '',
  map_link: c.map_link || '',
  schedule: c.schedule || '',
  age_groups: c.age_groups || [],
  capacity: c.capacity || null,
  status: c.status,
});

const publicProgramme = (p) => ({
  id: p.id,
  name: p.name,
  code: p.code || '',
  description: p.description || '',
  age_group_label: p.age_group_label,
  approved_fee: p.approved_fee || null,
  schedule: p.schedule || '',
  availability: p.availability,
});

const publicStory = (s) => ({
  id: s.id,
  title: s.title,
  category: s.category,
  description: s.description || '',
  publication_date: s.publication_date || null,
  centre_name: s.centre_name || '',
});

export default async function (req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    if (rateLimited(req)) {
      return Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;

    if (action === 'reference_data') {
      const [centres, programmes, stories] = await Promise.all([
        service.entities.Centre.filter(
          { status: { $in: ['open_for_registration', 'assessments_open'] } },
          { sort: 'name', limit: 100 }
        ),
        service.entities.Programme.filter({ status: 'active' }, { sort: 'name', limit: 50 }),
        service.entities.Story.filter({ status: 'published' }, { sort: '-publication_date', limit: 20 }),
      ]);
      return Response.json({
        centres: (centres.items || []).map(publicCentre),
        programmes: (programmes.items || []).map(publicProgramme),
        stories: (stories.items || []).map(publicStory),
      });
    }

    if (action === 'submit_registration') {
      const payload = body.registration || {};
      const childName = str(payload.child_name, 120);
      const guardianName = str(payload.guardian_name, 120);
      const guardianPhone = str(payload.guardian_phone, 32);
      if (!childName || !guardianName || !guardianPhone) {
        return Response.json(
          { error: 'Child name, guardian name and guardian phone are required' },
          { status: 400 }
        );
      }
      let centre = null;
      let programme = null;
      if (payload.centre_id) {
        centre = await service.entities.Centre.get(payload.centre_id).catch(() => null);
        if (!centre || !['open_for_registration', 'assessments_open'].includes(centre.status)) {
          return Response.json({ error: 'That centre is not open for registration' }, { status: 400 });
        }
      }
      if (payload.programme_id) {
        programme = await service.entities.Programme.get(payload.programme_id).catch(() => null);
        if (!programme || programme.status !== 'active') {
          return Response.json({ error: 'That programme is not available' }, { status: 400 });
        }
      }
      const reference = `HTT-REG-${Date.now().toString(36).toUpperCase()}`;
      const registration = await service.entities.Registration.create({
        reference,
        guardian_name: guardianName,
        guardian_email: str(payload.guardian_email, 160),
        guardian_phone: guardianPhone,
        guardian_address: str(payload.guardian_address, 240),
        child_name: childName,
        child_date_of_birth: str(payload.child_date_of_birth, 32),
        centre_id: centre?.id || '',
        centre_name: centre?.name || '',
        programme_id: programme?.id || '',
        programme_name: programme?.name || '',
        age_group: str(payload.age_group, 20) || programme?.age_group_label || '',
        pathway: payload.pathway === 'scholarship_assessment' ? 'scholarship_assessment' : 'paid_academy',
        document_status: 'pending',
        consent_media: payload.consent_media === true,
        consent_data: payload.consent_data === true,
        consent_medical: payload.consent_medical === true,
        payment_status: 'unpaid',
        amount_due: Number(programme?.approved_fee || 0),
        amount_paid: 0,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
        source: 'public_website',
        status_history: [
          {
            status: 'submitted',
            note: 'Submitted through the public website',
            at: new Date().toISOString(),
            by: 'public_website',
          },
        ],
      });
      return Response.json({ reference, id: registration.id, status: 'submitted' });
    }

    if (action === 'submit_enquiry') {
      const contactName = str(body.contact_name, 120);
      if (!contactName) return Response.json({ error: 'Contact name is required' }, { status: 400 });
      const enquiry = await service.entities.Enquiry.create({
        contact_name: contactName,
        email: str(body.email, 160),
        phone: str(body.phone, 32),
        type: ['general', 'registration', 'assessment', 'callback', 'partnership', 'sponsorship', 'school_project'].includes(body.type)
          ? body.type
          : 'general',
        source: 'website',
        status: 'new',
        priority: 'medium',
        subject: str(body.subject, 160),
        message: str(body.message, 2000),
        consent_to_contact: body.consent_to_contact !== false,
      });
      return Response.json({ id: enquiry.id, status: 'new' });
    }

    if (action === 'submit_scholarship') {
      const applicant = str(body.applicant_name, 120);
      const guardianName = str(body.guardian_name, 120);
      if (!applicant || !guardianName) {
        return Response.json({ error: 'Applicant and guardian names are required' }, { status: 400 });
      }
      const application = await service.entities.ScholarshipApplication.create({
        reference: `HTT-SCH-${Date.now().toString(36).toUpperCase()}`,
        applicant_name: applicant,
        guardian_name: guardianName,
        guardian_email: str(body.guardian_email, 160),
        guardian_phone: str(body.guardian_phone, 32),
        centre_id: str(body.centre_id, 40),
        programme_id: str(body.programme_id, 40),
        notes: str(body.notes, 1000),
        status: 'received',
        decision_history: [
          { status: 'received', note: 'Submitted through the public website', at: new Date().toISOString(), by: 'public_website' },
        ],
      });
      return Response.json({ reference: application.reference, status: 'received' });
    }

    if (action === 'submit_sponsorship') {
      const contactName = str(body.contact_name, 120);
      if (!contactName) return Response.json({ error: 'Contact name is required' }, { status: 400 });
      const enquiry = await service.entities.SponsorshipEnquiry.create({
        contact_name: contactName,
        organisation: str(body.organisation, 160),
        email: str(body.email, 160),
        phone: str(body.phone, 32),
        category: ['individual_player', 'scholarship_fund', 'school_project', 'corporate_partnership'].includes(body.category)
          ? body.category
          : 'corporate_partnership',
        proposed_amount: Number(body.proposed_amount || 0),
        status: 'new',
        priority: 'medium',
        notes: str(body.notes, 1000),
        source: 'public_website',
      });
      return Response.json({ id: enquiry.id, status: 'new' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Request could not be processed' }, { status: 500 });
  }
}