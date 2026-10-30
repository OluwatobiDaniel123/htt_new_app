'use strict';

const upSql = `
CREATE TABLE staff_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(320) NOT NULL UNIQUE, password_hash varchar(255) NOT NULL,
  full_name varchar(200) NOT NULL, phone varchar(40), active boolean NOT NULL DEFAULT true, suspended_at timestamptz,
  last_login_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(64) NOT NULL UNIQUE, name varchar(120) NOT NULL, description text, system_role boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(100) NOT NULL UNIQUE, description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE staff_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_account_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE, role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(staff_account_id, role_id));
CREATE TABLE role_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, access_level varchar(16) NOT NULL DEFAULT 'full' CHECK (access_level IN ('view','full')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(role_id, permission_id));
CREATE TABLE refresh_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_account_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE, token_hash varchar(255) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_by_ip varchar(64), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE password_reset_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_account_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE, token_hash varchar(255) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, code varchar(40) UNIQUE, area varchar(160), address text, map_link text,
  lead_coach varchar(200), staff_emails text[] NOT NULL DEFAULT '{}', age_groups text[] NOT NULL DEFAULT '{}', schedule text,
  approved_fee numeric(12,2) CHECK (approved_fee IS NULL OR approved_fee >= 0), capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  contact_name varchar(200), contact_phone varchar(40), contact_email varchar(320), operational_notes text,
  registration_available boolean NOT NULL DEFAULT false,
  review_status varchar(32) CHECK (review_status IS NULL OR review_status IN ('pending_verification','approved')),
  status varchar(40) NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','open_for_registration','assessments_open','coming_soon','temporarily_unavailable')),
  proposed_area boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, code varchar(40) UNIQUE, description text, age_group_label varchar(80),
  age_min integer CHECK (age_min IS NULL OR age_min >= 0), age_max integer CHECK (age_max IS NULL OR age_max >= age_min),
  approved_fee numeric(12,2) CHECK (approved_fee IS NULL OR approved_fee >= 0), currency char(3) NOT NULL DEFAULT 'NGN', schedule text,
  capacity integer CHECK (capacity IS NULL OR capacity >= 0), assessments_required boolean NOT NULL DEFAULT true,
  availability varchar(40) CHECK (availability IS NULL OR availability IN ('open','waitlist','closed')),
  status varchar(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active','planned','archived')), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE centre_programmes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE, programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(centre_id, programme_id));
CREATE TABLE staff_centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_account_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(staff_account_id, centre_id)
);

CREATE TABLE registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(60) NOT NULL UNIQUE, guardian_name varchar(200) NOT NULL, guardian_email varchar(320),
  guardian_phone varchar(40) NOT NULL, guardian_address text, child_name varchar(200) NOT NULL, child_date_of_birth date,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL, age_group varchar(20),
  pathway varchar(32) NOT NULL DEFAULT 'paid_academy' CHECK (pathway IN ('paid_academy','scholarship_assessment')),
  document_status varchar(24) NOT NULL DEFAULT 'pending' CHECK (document_status IN ('not_submitted','pending','verified','rejected')),
  consent_media boolean NOT NULL DEFAULT false, consent_data boolean NOT NULL DEFAULT false, consent_medical boolean NOT NULL DEFAULT false,
  payment_status varchar(24) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','not_required')),
  amount_due numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0), payment_reference varchar(120),
  assigned_reviewer_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, internal_notes text,
  submitted_at timestamptz, reviewed_at timestamptz,
  status varchar(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','assessment_required','information_required','approved','rejected')),
  source varchar(32) NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','public_website')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_code varchar(40) UNIQUE, full_name varchar(200) NOT NULL, date_of_birth date NOT NULL,
  age_group varchar(20) CHECK (age_group IS NULL OR age_group IN ('8-10','11-12','13-14','other')),
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  registration_status varchar(32) NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('prospective','registered','waitlisted','archived')),
  scholarship_status varchar(32) NOT NULL DEFAULT 'none' CHECK (scholarship_status IN ('none','applicant','active','declined')),
  document_verification varchar(24) NOT NULL DEFAULT 'pending' CHECK (document_verification IN ('pending','verified','rejected')),
  development_notes text, match_appearances integer NOT NULL DEFAULT 0 CHECK (match_appearances >= 0), match_notes text, school varchar(180),
  archived boolean NOT NULL DEFAULT false, archived_reason text,
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE registrations ADD COLUMN linked_player_id uuid REFERENCES players(id) ON DELETE SET NULL;
CREATE TABLE guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name varchar(200) NOT NULL, email varchar(320), phone varchar(40) NOT NULL,
  address text, preferred_contact varchar(24) CHECK (preferred_contact IS NULL OR preferred_contact IN ('phone','whatsapp','email','sms')),
  communication_preferences text[] NOT NULL DEFAULT '{}', account_status varchar(24) NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','inactive')),
  consent_status varchar(24) NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending','partial','granted','withdrawn')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE registrations ADD COLUMN guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL;
CREATE TABLE player_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE RESTRICT, relationship varchar(24) NOT NULL DEFAULT 'guardian' CHECK (relationship IN ('mother','father','guardian','other')),
  is_primary boolean NOT NULL DEFAULT false, is_emergency_contact boolean NOT NULL DEFAULT false, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(player_id, guardian_id)
);
CREATE UNIQUE INDEX uq_player_guardians_primary ON player_guardians(player_id) WHERE is_primary = true;

CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  session_date date NOT NULL, coach_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  present_count integer NOT NULL DEFAULT 0 CHECK (present_count >= 0), absent_count integer NOT NULL DEFAULT 0 CHECK (absent_count >= 0), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT, status varchar(24) NOT NULL CHECK (status IN ('present','absent','late','excused')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id, player_id)
);
CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL, type varchar(40) NOT NULL CHECK (type IN ('trial','periodic','scholarship')), scheduled_at timestamptz,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, coach_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  criteria_scores jsonb NOT NULL DEFAULT '{}', overall_rating numeric(5,2) CHECK (overall_rating IS NULL OR overall_rating >= 0),
  feedback text, improvement_targets text[] NOT NULL DEFAULT '{}', completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE player_safeguarding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  created_by_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, note text NOT NULL, classification varchar(24) NOT NULL DEFAULT 'restricted',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  storage_provider varchar(24) NOT NULL DEFAULT 'cloudinary', provider_asset_id varchar(255) NOT NULL UNIQUE, secure_url text NOT NULL,
  resource_type varchar(24) NOT NULL CHECK (resource_type IN ('image','video','raw')), mime_type varchar(120), byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  original_name varchar(255), access varchar(16) NOT NULL DEFAULT 'private' CHECK (access IN ('private','public')), metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_type varchar(16) NOT NULL CHECK (subject_type IN ('player','guardian')),
  player_id uuid REFERENCES players(id) ON DELETE RESTRICT, guardian_id uuid REFERENCES guardians(id) ON DELETE RESTRICT,
  consent_type varchar(40) NOT NULL CHECK (consent_type IN ('media_photography','media_video','data_processing','medical','travel')),
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('granted','pending','withdrawn')),
  granted_at date, expires_at date, document_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((subject_type='player' AND player_id IS NOT NULL AND guardian_id IS NULL) OR (subject_type='guardian' AND guardian_id IS NOT NULL AND player_id IS NULL))
);
CREATE TABLE registration_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL, name varchar(255) NOT NULL, status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registration_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL, note text, actor_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(200) NOT NULL,
  type varchar(40) NOT NULL CHECK (type IN ('individual_player','scholarship_fund','school_project','corporate_partnership')),
  contact_name varchar(200), email varchar(320), phone varchar(40), organisation varchar(200), address text,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('prospect','active','paused','closed')),
  notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sponsor_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  staff_account_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, channel varchar(24) NOT NULL, summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE funding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sponsor_id uuid REFERENCES sponsors(id) ON DELETE SET NULL,
  kind varchar(24) NOT NULL CHECK (kind IN ('pledge','payment','refund')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0), currency char(3) NOT NULL DEFAULT 'NGN', reference varchar(100) UNIQUE,
  record_date date NOT NULL, status varchar(24) NOT NULL CHECK (status IN ('pledged','confirmed','received','cancelled')),
  category varchar(40) NOT NULL CHECK (category IN ('individual_player','scholarship_fund','school_project','corporate_partnership')),
  target_label varchar(200), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE scholarship_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(60) NOT NULL UNIQUE, applicant_name varchar(200) NOT NULL, guardian_name varchar(200) NOT NULL,
  guardian_email varchar(320), guardian_phone varchar(40), player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  eligibility_checks jsonb NOT NULL DEFAULT '[]', assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  assessment_result varchar(40), notes text,
  status varchar(32) NOT NULL DEFAULT 'received' CHECK (status IN ('received','eligibility_review','assessment_scheduled','assessed','selection_panel','approved','waitlisted','declined')),
  decision_notes text,
  award_amount numeric(12,2) CHECK (award_amount IS NULL OR award_amount >= 0), funding_secured numeric(12,2) CHECK (funding_secured IS NULL OR funding_secured >= 0),
  funding_required numeric(12,2) CHECK (funding_required IS NULL OR funding_required >= 0), start_date date, end_date date, renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE scholarship_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES scholarship_applications(id) ON DELETE CASCADE,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL, name varchar(255) NOT NULL, status varchar(24) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE scholarship_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES scholarship_applications(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, status varchar(32) NOT NULL, note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE scholarship_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid REFERENCES scholarship_applications(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT, programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, award_amount numeric(12,2) NOT NULL CHECK (award_amount >= 0), benefit_description text,
  funding_secured numeric(12,2) NOT NULL DEFAULT 0 CHECK (funding_secured >= 0), funding_required numeric(12,2) NOT NULL DEFAULT 0 CHECK (funding_required >= 0),
  start_date date, end_date date, renewal_date date,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','withdrawn')), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE scholarship_award_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scholarship_award_id uuid NOT NULL REFERENCES scholarship_awards(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(scholarship_award_id,sponsor_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(100) NOT NULL UNIQUE,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL, player_name varchar(200), payer_name varchar(200) NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0), currency char(3) NOT NULL DEFAULT 'NGN',
  method varchar(32) NOT NULL CHECK (method IN ('paystack','bank_transfer','cash','pos','waiver')),
  purpose varchar(40) NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration','assessment','scholarship_contribution','other')),
  status varchar(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','partially_refunded')),
  paid_at timestamptz, receipt_number varchar(100) UNIQUE, gateway_reference varchar(160) UNIQUE,
  refund_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0 AND refund_amount <= amount), refund_reason text,
  notes text, recorded_by_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT, amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(payment_id,registration_id)
);
CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  provider varchar(32) NOT NULL, provider_event_id varchar(200) NOT NULL, event_type varchar(100) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, processing_status varchar(24) NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}', UNIQUE(provider,provider_event_id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL, code varchar(40) UNIQUE, age_categories text[] NOT NULL DEFAULT '{}',
  start_date date, end_date date, status varchar(24) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_preparation','active','completed')),
  points_win integer NOT NULL DEFAULT 3 CHECK (points_win >= 0), points_draw integer NOT NULL DEFAULT 1 CHECK (points_draw >= 0), points_loss integer NOT NULL DEFAULT 0 CHECK (points_loss >= 0), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL, season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, age_category varchar(40) NOT NULL, coach_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','withdrawn')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, season_id)
);
CREATE TABLE team_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE, player_id uuid NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  jersey_number integer CHECK (jersey_number IS NULL OR jersey_number > 0), joined_at date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(team_id,player_id)
);
CREATE TABLE fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), season_id uuid REFERENCES seasons(id) ON DELETE RESTRICT, age_category varchar(40),
  home_team_id uuid NOT NULL, away_team_id uuid NOT NULL,
  home_team_name varchar(160), away_team_name varchar(160), season_name varchar(160), match_date timestamptz NOT NULL,
  venue varchar(200), status varchar(24) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','postponed','cancelled')),
  home_score integer CHECK (home_score IS NULL OR home_score >= 0), away_score integer CHECK (away_score IS NULL OR away_score >= 0), match_report text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id),
  FOREIGN KEY (home_team_id, season_id) REFERENCES teams(id, season_id) ON DELETE RESTRICT,
  FOREIGN KEY (away_team_id, season_id) REFERENCES teams(id, season_id) ON DELETE RESTRICT
);

CREATE TABLE enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_name varchar(200) NOT NULL, email varchar(320), phone varchar(40),
  type varchar(40) NOT NULL DEFAULT 'general' CHECK (type IN ('general','registration','assessment','callback','partnership','sponsorship','school_project')),
  source varchar(40) NOT NULL DEFAULT 'admin', status varchar(24) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','in_progress','resolved','closed')),
  assigned_to_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  priority varchar(20) NOT NULL DEFAULT 'medium', subject varchar(200), message text, notes text, next_follow_up timestamptz,
  consent_to_contact boolean NOT NULL DEFAULT true, opted_out boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE enquiry_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enquiry_id uuid NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  staff_account_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, channel varchar(24) NOT NULL, direction varchar(16) NOT NULL,
  summary text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(200) NOT NULL, enquiry_id uuid REFERENCES enquiries(id) ON DELETE SET NULL,
  contact_name varchar(200),
  assigned_to_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, due_date date, status varchar(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  priority varchar(20) NOT NULL DEFAULT 'medium', notes text, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sponsorship_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contact_name varchar(200) NOT NULL, organisation varchar(200), email varchar(320), phone varchar(40),
  category varchar(40) NOT NULL CHECK (category IN ('individual_player','scholarship_fund','school_project','corporate_partnership')),
  proposed_amount numeric(12,2) CHECK (proposed_amount IS NULL OR proposed_amount >= 0),
  status varchar(24) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','under_discussion','proposal_sent','awaiting_payment','confirmed','declined','closed')),
  priority varchar(20) NOT NULL DEFAULT 'medium', notes text, source varchar(40) NOT NULL DEFAULT 'admin', assigned_to_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(220) NOT NULL,
  category varchar(50) NOT NULL CHECK (category IN ('player_stories','training_highlights','coaching_education','centre_news','league_updates','scholarship_progress','sponsor_impact','school_project_updates')),
  description text,
  centre_id uuid REFERENCES centres(id) ON DELETE SET NULL, publication_date date, author_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','published','archived')),
  involves_children boolean NOT NULL DEFAULT true, safeguarding_approved boolean NOT NULL DEFAULT false, safeguarding_notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR NOT involves_children OR safeguarding_approved)
);
CREATE TABLE story_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT, sort_order integer NOT NULL DEFAULT 0, caption text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(story_id,media_asset_id)
);
CREATE TABLE story_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL, decision varchar(24) NOT NULL, note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(200) NOT NULL, body text NOT NULL, type varchar(40) NOT NULL CHECK (type IN ('info','warning','success','alert')),
  category varchar(40), link text, read boolean NOT NULL DEFAULT false, for_staff_id uuid REFERENCES staff_accounts(id) ON DELETE CASCADE,
  delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
  actor_email varchar(320), actor_name varchar(200), action varchar(80) NOT NULL, entity_name varchar(100) NOT NULL,
  record_id varchar(100), record_label varchar(255), details text, before_data jsonb, after_data jsonb, ip_address varchar(64), user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_name varchar(200) NOT NULL DEFAULT 'HTT Academy Nigeria', contact_email varchar(320), contact_phone varchar(40),
  currency char(3) NOT NULL DEFAULT 'NGN', registration_prefix varchar(40) NOT NULL DEFAULT 'HTT-REG', player_id_prefix varchar(40) NOT NULL DEFAULT 'HTT-P',
  retention_years integer NOT NULL DEFAULT 7 CHECK (retention_years > 0), payment_provider varchar(40) NOT NULL DEFAULT 'paystack',
  league_status varchar(24) NOT NULL DEFAULT 'planned', school_project_status varchar(24) NOT NULL DEFAULT 'proposed',
  scholarship_target integer NOT NULL DEFAULT 20 CHECK (scholarship_target >= 0), assessment_criteria jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_registrations_status_submitted ON registrations(status, submitted_at DESC);
CREATE INDEX idx_registrations_guardian_phone ON registrations(guardian_phone);
CREATE INDEX idx_registrations_centre_programme ON registrations(centre_id, programme_id);
CREATE INDEX idx_players_centre_status ON players(centre_id, registration_status) WHERE archived = false;
CREATE INDEX idx_players_programme ON players(programme_id);
CREATE INDEX idx_players_name ON players(full_name);
CREATE INDEX idx_guardians_phone ON guardians(phone);
CREATE INDEX idx_guardians_email ON guardians(email) WHERE email IS NOT NULL;
CREATE INDEX idx_staff_roles_role ON staff_roles(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_refresh_sessions_staff_expiry ON refresh_sessions(staff_account_id, expires_at);
CREATE INDEX idx_password_reset_staff_expiry ON password_reset_tokens(staff_account_id, expires_at);
CREATE INDEX idx_centre_programmes_programme ON centre_programmes(programme_id);
CREATE INDEX idx_staff_centres_centre ON staff_centres(centre_id);
CREATE INDEX idx_attendance_session_date ON attendance_sessions(session_date DESC, centre_id);
CREATE INDEX idx_attendance_sessions_programme ON attendance_sessions(programme_id, session_date DESC);
CREATE INDEX idx_attendance_player ON attendance_records(player_id, created_at DESC);
CREATE INDEX idx_assessments_player_date ON assessments(player_id, scheduled_at DESC);
CREATE INDEX idx_assessments_centre_date ON assessments(centre_id, scheduled_at DESC);
CREATE INDEX idx_assessments_registration ON assessments(registration_id);
CREATE INDEX idx_consent_guardian_status ON consent_records(guardian_id, status);
CREATE INDEX idx_registration_documents_asset ON registration_documents(media_asset_id);
CREATE INDEX idx_scholarship_applications_status_date ON scholarship_applications(status, created_at DESC);
CREATE INDEX idx_scholarship_applications_player ON scholarship_applications(player_id);
CREATE INDEX idx_scholarship_sponsors_sponsor ON scholarship_award_sponsors(sponsor_id);
CREATE INDEX idx_payments_status_created ON payments(status, created_at DESC);
CREATE INDEX idx_payments_player ON payments(player_id, paid_at DESC);
CREATE INDEX idx_payment_allocations_registration ON payment_allocations(registration_id);
CREATE INDEX idx_payment_events_payment ON payment_events(payment_id, received_at DESC);
CREATE INDEX idx_funding_date_category ON funding_records(record_date DESC, category);
CREATE INDEX idx_funding_sponsor ON funding_records(sponsor_id, record_date DESC);
CREATE INDEX idx_enquiries_status_created ON enquiries(status, created_at DESC);
CREATE INDEX idx_enquiries_assignee ON enquiries(assigned_to_id, status);
CREATE INDEX idx_tasks_assignee_due ON follow_up_tasks(assigned_to_id, due_date, status);
CREATE INDEX idx_sponsorship_enquiries_status_date ON sponsorship_enquiries(status, created_at DESC);
CREATE INDEX idx_stories_status_date ON stories(status, publication_date DESC);
CREATE INDEX idx_story_media_asset ON story_media(media_asset_id);
CREATE INDEX idx_teams_centre ON teams(centre_id, season_id);
CREATE INDEX idx_teams_coach ON teams(coach_id);
CREATE INDEX idx_team_players_player ON team_players(player_id);
CREATE INDEX idx_fixtures_season_date ON fixtures(season_id, match_date);
CREATE INDEX idx_fixtures_home_team ON fixtures(home_team_id, match_date);
CREATE INDEX idx_fixtures_away_team ON fixtures(away_team_id, match_date);
CREATE INDEX idx_notifications_staff_read ON notifications(for_staff_id, read, created_at DESC);
CREATE INDEX idx_audit_entity_created ON audit_logs(entity_name, created_at DESC);
CREATE INDEX idx_audit_actor_created ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_consent_player_status ON consent_records(player_id, status);
`;

const tables = [
  'application_settings','audit_logs','notifications','story_approvals','story_media','stories','sponsorship_enquiries',
  'follow_up_tasks','enquiry_communications','enquiries','fixtures','team_players','teams','seasons','payment_events',
  'payment_allocations','payments','scholarship_award_sponsors','scholarship_awards','scholarship_decisions','scholarship_documents',
  'scholarship_applications','funding_records','sponsor_communications','sponsors','registration_status_history','registration_documents','consent_records',
  'media_assets','player_safeguarding_records','assessments','attendance_records','attendance_sessions','player_guardians','guardians',
  'players','registrations','staff_centres','centre_programmes','programmes','centres','password_reset_tokens','refresh_sessions','role_permissions','staff_roles','permissions','roles','staff_accounts',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(upSql, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of tables) {
        await queryInterface.sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE`, { transaction });
      }
    });
  },
};
