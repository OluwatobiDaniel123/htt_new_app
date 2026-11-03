import { api, fromUiRecord, toUiRecord } from '@/api/client';

const endpoints = {
  User: '/staff',
  Player: '/players',
  Guardian: '/guardians',
  Registration: '/registrations',
  Centre: '/centres',
  Programme: '/programmes',
  Notification: '/notifications',
  Payment: '/payments',
  AttendanceSession: '/attendance-sessions',
  Assessment: '/assessments',
  ScholarshipApplication: '/scholarship-applications',
  ScholarshipAward: '/scholarship-awards',
  Sponsor: '/sponsors',
  FundingRecord: '/funding-records',
  Season: '/seasons',
  Team: '/teams',
  Fixture: '/fixtures',
  Enquiry: '/enquiries',
  FollowUpTask: '/follow-up-tasks',
  SponsorshipEnquiry: '/sponsorship-enquiries',
  Story: '/stories',
  ApplicationSettings: '/settings',
  ConsentRecord: '/consent-records',
  AuditLog: '/audit-logs',
};

const searchableFields = {
  Player: ['full_name', 'player_id', 'player_code'],
  Guardian: ['full_name', 'phone', 'email'],
  Registration: ['child_name', 'guardian_name', 'reference', 'guardian_phone'],
  Centre: ['name', 'code', 'area'],
  Programme: ['name', 'age_group_label'],
  User: ['full_name', 'email'],
  AttendanceSession: ['notes'], Assessment: ['player_name'],
  ScholarshipApplication: ['reference', 'applicant_name', 'guardian_name'],
  ScholarshipAward: ['benefit_description', 'notes'], Sponsor: ['name', 'contact_name', 'organisation', 'email'],
  FundingRecord: ['reference', 'target_label', 'notes'], Season: ['name', 'code'], Team: ['name', 'age_category'],
  Fixture: ['venue', 'match_report'], Enquiry: ['contact_name', 'email', 'phone', 'subject', 'message'],
  FollowUpTask: ['title', 'contact_name', 'notes'], SponsorshipEnquiry: ['contact_name', 'organisation', 'email'], Story: ['title', 'description'],
};

const getQuery = (entity, query, limit, page = 1) => {
  const params = { page, limit };
  let search = '';
  const supported = {
    Player: ['registration_status', 'scholarship_status', 'document_verification', 'age_group', 'centre_id', 'archived'],
    Guardian: ['account_status', 'consent_status'],
    Registration: ['status', 'centre_id', 'programme_id'],
    Centre: ['status', 'review_status'],
    Programme: ['status', 'availability'],
    User: ['active'],
    AuditLog: ['action', 'entity_name'],
    Payment: ['status', 'method', 'registration_id', 'programme_id', 'centre_id', 'player_id', 'from', 'to'],
    AttendanceSession: ['centre_id', 'programme_id', 'status'],
    Assessment: ['player_id', 'centre_id', 'status', 'type'],
    ScholarshipApplication: ['status', 'player_id', 'centre_id', 'programme_id'],
    ScholarshipAward: ['status', 'player_id', 'centre_id', 'programme_id'],
    Sponsor: ['status', 'type'], FundingRecord: ['sponsor_id', 'category', 'kind', 'status', 'currency'],
    Season: ['status'], Team: ['season_id', 'centre_id', 'status', 'age_category'],
    Fixture: ['season_id', 'status', 'age_category', 'home_team_id', 'away_team_id'],
    Enquiry: ['status', 'type', 'assigned_to_id', 'priority'], FollowUpTask: ['enquiry_id', 'assigned_to_id', 'status', 'priority'],
    SponsorshipEnquiry: ['status', 'category', 'assigned_to_id', 'priority'], Story: ['category', 'status', 'centre_id'],
  }[entity] || [];
  for (const [key, value] of Object.entries(query || {})) {
    if (key === '$or' && Array.isArray(value)) {
      search = value.map((entry) => Object.values(entry || {})[0]?.$regex).find(Boolean) || '';
    } else if (value && typeof value === 'object' && value.$regex) search = value.$regex;
    else if (supported.includes(key) && value !== '') {
      const apiKey = key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
      params[apiKey] = entity === 'Payment' && key === 'status' && value === 'paid' ? 'successful' : value;
    }
  }
  if (search) params.search = search;
  return params;
};

const normalizeRecord = (entity, raw) => {
  const row = toUiRecord(raw);
  row.created_date ??= row.created_at;
  if (entity === 'Player') {
    row.player_id ??= row.player_code;
    row.centre_name ??= row.centre?.name;
    row.programme_name ??= row.programme?.name;
  }
  if (entity === 'Centre') row.programme_ids ??= row.programmes?.map((item) => item.id) || [];
  if (entity === 'Programme') row.centre_ids ??= row.centres?.map((item) => item.id) || [];
  if (entity === 'Programme') row.age_group_label ??= row.age_group_label;
  if (entity === 'Registration') {
    row.centre_name ??= row.centre?.name;
    row.programme_name ??= row.programme?.name;
    row.submitted_at ??= row.created_at;
    row.document_status ??= row.documents?.some((doc) => doc.status === 'rejected') ? 'rejected' : row.documents?.length ? 'pending' : 'pending';
  }
  if (entity === 'Payment' && row.status === 'successful') row.status = 'paid';
  if (entity === 'User') {
    row.role = row.roles?.[0]?.key || 'user';
    row.role_ids = row.roles?.map((role) => role.id) || [];
  }
  if (entity === 'AttendanceSession') {
    row.centre_name ??= row.centre?.name;
    row.programme_name ??= row.programme?.name;
    row.coach_email ??= row.coach?.email;
  }
  if (entity === 'Assessment') {
    row.player_name ??= row.player?.full_name;
    row.centre_name ??= row.centre?.name;
    row.coach_name ??= row.coach?.full_name;
    row.coach_email ??= row.coach?.email;
  }
  if (entity === 'ScholarshipApplication' || entity === 'ScholarshipAward') {
    row.player_name ??= row.player?.full_name;
    row.centre_name ??= row.centre?.name;
    row.programme_name ??= row.programme?.name;
  }
  if (entity === 'FundingRecord') row.sponsor_name ??= row.sponsor?.name;
  if (entity === 'Team') {
    row.season_name ??= row.season?.name;
    row.centre_name ??= row.centre?.name;
    row.player_ids ??= row.players?.map((player) => player.id) || [];
    row.roster ??= row.players || [];
  }
  if (entity === 'Fixture') {
    row.season_name ??= row.season?.name;
    row.home_team_name ??= row.home_team?.name;
    row.away_team_name ??= row.away_team?.name;
  }
  if (entity === 'Enquiry' || entity === 'FollowUpTask' || entity === 'SponsorshipEnquiry') {
    row.assigned_name ??= row.assignee?.full_name;
    row.assigned_email ??= row.assignee?.email;
    row.assigned_to ??= row.assignee?.email;
  }
  if (entity === 'Story') row.centre_name ??= row.centre?.name;
  if (entity === 'ConsentRecord') {
    row.player_name ??= row.player?.full_name;
    row.guardian_name ??= row.guardian?.full_name;
  }
  if (entity === 'AttendanceRecord') row.session_date ??= row.session?.session_date;
  if (entity === 'GuardianLink') {
    row.guardian_name ??= row.guardian?.full_name;
    row.is_primary ??= row.is_primary ?? row.isPrimary;
    row.is_emergency_contact ??= row.is_emergency_contact ?? row.isEmergencyContact;
  }
  return row;
};

export const supportsResource = (entity) => Boolean(endpoints[entity]) || entity === 'AttendanceRecord' || entity === 'GuardianLink';

export async function listResource(entity, query = {}, options = {}) {
  const path = endpoints[entity];
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  if (entity === 'AttendanceRecord') {
    if (!query.player_id) throw new Error('A player id is required to load attendance history.');
    const response = await api.get(`/players/${encodeURIComponent(query.player_id)}/attendance`, { page, limit });
    const items = (response.items || []).map((row) => normalizeRecord(entity, row));
    return { ...response, items, page: response.page || page, limit: response.limit || limit };
  }
  if (entity === 'GuardianLink') {
    if (!query.player_id) throw new Error('A player id is required to load guardian links.');
    const response = await api.get(`/players/${encodeURIComponent(query.player_id)}/guardians`, { page, limit });
    const items = (response.items || []).map((row) => normalizeRecord(entity, row));
    return { ...response, items, page: response.page || page, limit: response.limit || limit };
  }
  if (!path) throw new Error(`The ${entity} module is not available through the custom API yet.`);
  if (entity === 'AuditLog') {
    const params = { page, limit, search: Object.values(query?.$or || {}).map((item) => item && Object.values(item)[0]?.$regex).find(Boolean) || '' };
    for (const key of ['action', 'entity_name']) if (query[key]) params[key === 'entity_name' ? 'entityName' : key] = query[key];
    const response = await api.get(path, params);
    return { ...response, items: (response.items || []).map((row) => normalizeRecord(entity, row)) };
  }
  if (entity === 'Notification' || entity === 'AuditLog') {
    const response = await api.get(path, { page: options.page || 1, limit });
    return { ...response, items: (response.items || []).map((row) => normalizeRecord(entity, row)) };
  }
  const response = await api.get(path, getQuery(entity, query, limit, options.page || 1));
  return { ...response, items: (response.items || []).map((row) => normalizeRecord(entity, row)) };
}

export async function getResource(entity, id) {
  const data = await api.get(`${endpoints[entity]}/${encodeURIComponent(id)}`);
  const record = data?.player || data?.guardian || data?.registration || data?.centre || data?.programme || data?.staff || data;
  return normalizeRecord(entity, record);
}

const acceptedFields = {
  Player: ['full_name','date_of_birth','age_group','centre_id','programme_id','registration_status','scholarship_status','document_verification','development_notes','match_appearances','match_notes','school'],
  Guardian: ['full_name','email','phone','address','preferred_contact','communication_preferences','account_status','consent_status','notes'],
  Registration: ['guardian_name','guardian_email','guardian_phone','guardian_address','child_name','child_date_of_birth','centre_id','programme_id','age_group','pathway','consent_media','consent_data','consent_medical','assigned_reviewer_id','internal_notes','initial_note'],
  Centre: ['slug','name','code','area','address','city','region','map_embed','map_link','lead_coach','staff_emails','age_groups','schedule','approved_fee','capacity','contact_name','contact_phone','contact_email','operational_notes','registration_available','review_status','status','proposed_area','programme_ids','image','coming_soon'],
  Programme: ['slug','name','tagline','code','description','age_group','age_group_label','training_days','duration','price','benefits','requirements','equipment','icon','featured','age_min','age_max','approved_fee','schedule','capacity','assessments_required','availability','status','notes','centre_ids'],
  AttendanceSession: ['centre_id','programme_id','session_date','coach_id','status','notes'],
  Assessment: ['player_id','registration_id','type','scheduled_at','centre_id','coach_id','coach_email','status','criteria_scores','overall_rating','feedback','improvement_targets','completed_at'],
  ScholarshipApplication: ['reference','applicant_name','guardian_name','guardian_email','guardian_phone','player_id','centre_id','programme_id','eligibility_checks','assessment_id','assessment_result','notes','status','decision_notes','award_amount','funding_secured','funding_required','start_date','end_date','renewal_date'],
  ScholarshipAward: ['application_id','player_id','programme_id','centre_id','award_amount','benefit_description','funding_secured','funding_required','start_date','end_date','renewal_date','status','notes'],
  Sponsor: ['name','type','contact_name','email','phone','organisation','address','status','notes'],
  FundingRecord: ['sponsor_id','category','kind','amount','currency','reference','record_date','status','target_label','notes'],
  Season: ['name','code','age_categories','start_date','end_date','status','points_win','points_draw','points_loss','notes'],
  Team: ['name','season_id','centre_id','age_category','coach_id','coach_email','status','roster_ids'],
  Fixture: ['season_id','age_category','home_team_id','away_team_id','match_date','venue','status','home_score','away_score','match_report'],
  Enquiry: ['contact_name','email','phone','type','source','status','assigned_to_id','assigned_to','priority','subject','message','notes','next_follow_up','consent_to_contact','opted_out'],
  FollowUpTask: ['title','enquiry_id','contact_name','assigned_to_id','assigned_to','due_date','status','priority','notes','completed_at'],
  SponsorshipEnquiry: ['contact_name','organisation','email','phone','category','proposed_amount','status','priority','notes','source','assigned_to_id'],
  Story: ['title','category','description','centre_id','publication_date','status','involves_children','safeguarding_approved','safeguarding_notes'],
  ConsentRecord: ['subject_type','player_id','guardian_id','consent_type','status','granted_at','expires_at','notes'],
  ApplicationSettings: ['academy_name','contact_email','contact_phone','currency','registration_prefix','player_id_prefix','retention_years','payment_provider','league_status','school_project_status','scholarship_target','assessment_criteria'],
};

export async function saveResource(entity, id, input) {
  const allowed = acceptedFields[entity];
  if (!allowed) throw new Error(`Editing ${entity} is not available through the custom API yet.`);
  const values = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
  if (['Enquiry','FollowUpTask'].includes(entity) && 'assigned_to' in values) {
    values.assigned_email = values.assigned_to || null;
    delete values.assigned_to;
  }
  if (entity === 'Team' && values.roster_ids) {
    values.player_ids = values.roster_ids;
    delete values.roster_ids;
  }
  const body = fromUiRecord(values);
  const nullableFields = {
    Player: ['centreId','programmeId','developmentNotes','matchNotes','school'],
    Guardian: ['email','address','preferredContact','notes'],
    Registration: ['guardianEmail','guardianAddress','childDateOfBirth','centreId','programmeId','assignedReviewerId','internalNotes'],
    Centre: ['slug','address','city','region','mapEmbed','mapLink','leadCoach','schedule','approvedFee','capacity','contactName','contactPhone','contactEmail','operationalNotes','image'],
    Programme: ['slug','tagline','description','ageGroup','trainingDays','duration','price','icon','code','ageMin','ageMax','approvedFee','schedule','capacity','notes'],
  }[entity] || [];
  for (const [key, value] of Object.entries(body)) if (value === '') {
    if (nullableFields.includes(key)) body[key] = null;
    else delete body[key];
  }
  if (entity === 'Player' && body.matchAppearances !== undefined) body.matchAppearances = Number(body.matchAppearances || 0);
  if (entity === 'Centre' || entity === 'Programme') {
    if (body.approvedFee !== undefined && body.approvedFee !== null && body.approvedFee !== '') body.approvedFee = Number(body.approvedFee);
    if (body.capacity !== undefined && body.capacity !== null && body.capacity !== '') body.capacity = Number(body.capacity);
    if (entity === 'Programme') {
      for (const key of ['ageMin', 'ageMax']) if (body[key] !== undefined && body[key] !== null && body[key] !== '') body[key] = Number(body[key]);
    }
  }
  if (id && entity === 'Centre' && ['status','reviewStatus','proposedArea','registrationAvailable'].some((key) => key in body)) {
    const status = Object.fromEntries(['status','reviewStatus','proposedArea','registrationAvailable'].filter((key) => key in body).map((key) => [key, body[key]]));
    await api.patch(`${endpoints[entity]}/${id}/status`, status);
    for (const key of Object.keys(status)) delete body[key];
  }
  if (id && entity === 'Player' && 'registrationStatus' in body) {
    await api.patch(`${endpoints[entity]}/${id}/status`, { registrationStatus: body.registrationStatus });
    delete body.registrationStatus;
  }
  if (id && entity === 'Programme' && ['status','availability'].some((key) => key in body)) {
    const status = Object.fromEntries(['status','availability'].filter((key) => key in body).map((key) => [key, body[key]]));
    await api.patch(`${endpoints[entity]}/${id}/status`, status);
    for (const key of Object.keys(status)) delete body[key];
  }
  const response = id ? await api.patch(`${endpoints[entity]}/${id}`, body) : await api.post(endpoints[entity], body);
  return normalizeRecord(entity, response?.player || response?.guardian || response?.registration || response?.centre || response?.programme || response);
}

export async function deleteResource(entity, id) {
  const bodies = { Player: { reason: 'Archived from staff directory' }, Guardian: {}, Centre: undefined, Programme: undefined };
  return api.delete(`${endpoints[entity]}/${id}`, bodies[entity]);
}
