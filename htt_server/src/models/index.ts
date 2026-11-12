import { sequelize } from "../config/database.js";
import { defineAcademyModels } from "./academy.js";
import { defineCommunicationModels } from "./communications.js";
import { defineContentModels } from "./content.js";
import { defineFinanceModels } from "./finance.js";
import { defineIdentityModels } from "./identity.js";
import { defineLeagueModels } from "./league.js";
import { defineSystemModels } from "./system.js";
import { defineCoachingApprenticeModels } from "./coachingApprentice.js";

export const models = {
  ...defineIdentityModels(sequelize),
  ...defineAcademyModels(sequelize),
  ...defineFinanceModels(sequelize),
  ...defineLeagueModels(sequelize),
  ...defineCommunicationModels(sequelize),
  ...defineContentModels(sequelize),
  ...defineSystemModels(sequelize),
};

export const coachingApprenticeApplication =
  defineCoachingApprenticeModels(sequelize).CoachingApprenticeApplication;

const {
  StaffAccount,
  Role,
  Permission,
  StaffRole,
  StaffCentre,
  RolePermission,
  RefreshSession,
  PasswordResetToken,
  Centre,
  CentreProgramme,
  Programme,
  Player,
  Guardian,
  PlayerGuardian,
  Registration,
  RegistrationDocument,
  RegistrationStatusHistory,
  EmergencyContact,
  AttendanceSession,
  AttendanceRecord,
  Assessment,
  ConsentRecord,
  PlayerSafeguardingRecord,
  Payment,
  PaymentAllocation,
  PaymentEvent,
  Refund,
  Sponsor,
  SponsorCommunication,
  FundingRecord,
  ScholarshipApplication,
  ScholarshipDocument,
  ScholarshipDecision,
  ScholarshipAward,
  ScholarshipAwardSponsor,
  Season,
  Team,
  TeamPlayer,
  Fixture,
  Enquiry,
  FollowUpTask,
  SponsorshipEnquiry,
  Notification,
  NotificationOutbox,
  NotificationAttempt,
  NotificationPreference,
  MediaAsset,
  Story,
  StoryMedia,
  StoryApproval,
  AuditLog,
  EnquiryCommunication,
} = models;

StaffAccount.belongsToMany(Role, {
  through: StaffRole,
  as: "roles",
  foreignKey: "staffAccountId",
  otherKey: "roleId",
});
Role.belongsToMany(StaffAccount, {
  through: StaffRole,
  as: "staff",
  foreignKey: "roleId",
  otherKey: "staffAccountId",
});
StaffAccount.belongsToMany(Centre, {
  through: StaffCentre,
  as: "assignedCentres",
  foreignKey: "staffAccountId",
  otherKey: "centreId",
});
Centre.belongsToMany(StaffAccount, {
  through: StaffCentre,
  as: "assignedStaff",
  foreignKey: "centreId",
  otherKey: "staffAccountId",
});
Role.belongsToMany(Permission, {
  through: RolePermission,
  as: "permissions",
  foreignKey: "roleId",
  otherKey: "permissionId",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  as: "roles",
  foreignKey: "permissionId",
  otherKey: "roleId",
});
StaffAccount.hasMany(RefreshSession, {
  foreignKey: "staffAccountId",
  as: "refreshSessions",
});
StaffAccount.hasMany(PasswordResetToken, {
  foreignKey: "staffAccountId",
  as: "passwordResetTokens",
});
StaffAccount.hasMany(AuditLog, { foreignKey: "actorId", as: "auditEvents" });
Player.hasMany(PlayerGuardian, { foreignKey: "playerId", as: "guardianLinks" });
Guardian.hasMany(PlayerGuardian, {
  foreignKey: "guardianId",
  as: "playerLinks",
});
PlayerGuardian.belongsTo(Player, { foreignKey: "playerId", as: "player" });
PlayerGuardian.belongsTo(Guardian, {
  foreignKey: "guardianId",
  as: "guardian",
});
StaffRole.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});
StaffRole.belongsTo(Role, { foreignKey: "roleId", as: "role" });
RolePermission.belongsTo(Role, { foreignKey: "roleId", as: "role" });
RolePermission.belongsTo(Permission, {
  foreignKey: "permissionId",
  as: "permission",
});
RefreshSession.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});
RefreshSession.belongsTo(RefreshSession, {
  foreignKey: "replacedBySessionId",
  as: "replacedBySession",
});
PasswordResetToken.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});

Centre.belongsToMany(Programme, {
  through: CentreProgramme,
  as: "programmes",
  foreignKey: "centreId",
  otherKey: "programmeId",
});
Programme.belongsToMany(Centre, {
  through: CentreProgramme,
  as: "centres",
  foreignKey: "programmeId",
  otherKey: "centreId",
});
Centre.hasMany(Player, { foreignKey: "centreId", as: "players" });
Player.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Programme.hasMany(Player, { foreignKey: "programmeId", as: "players" });
Player.belongsTo(Programme, { foreignKey: "programmeId", as: "programme" });
Player.belongsTo(Registration, {
  foreignKey: "registrationId",
  as: "sourceRegistration",
});
Player.belongsToMany(Guardian, {
  through: PlayerGuardian,
  as: "guardians",
  foreignKey: "playerId",
  otherKey: "guardianId",
});
Guardian.belongsToMany(Player, {
  through: PlayerGuardian,
  as: "players",
  foreignKey: "guardianId",
  otherKey: "playerId",
});
Registration.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Registration.belongsTo(Programme, {
  foreignKey: "programmeId",
  as: "programme",
});
Registration.belongsTo(StaffAccount, {
  foreignKey: "assignedReviewerId",
  as: "reviewer",
});
Registration.belongsTo(Player, { foreignKey: "linkedPlayerId", as: "player" });
Player.hasMany(Registration, {
  foreignKey: "linkedPlayerId",
  as: "registrations",
});
Registration.belongsTo(Guardian, { foreignKey: "guardianId", as: "guardian" });
Registration.hasMany(RegistrationDocument, {
  foreignKey: "registrationId",
  as: "documents",
});
Registration.hasMany(RegistrationStatusHistory, {
  foreignKey: "registrationId",
  as: "statusHistory",
});
Registration.hasOne(EmergencyContact, { foreignKey: "registrationId", as: "emergencyContact" });
EmergencyContact.belongsTo(Registration, { foreignKey: "registrationId", as: "registration" });
Player.hasMany(EmergencyContact, { foreignKey: "playerId", as: "emergencyContacts" });
EmergencyContact.belongsTo(Player, { foreignKey: "playerId", as: "player" });
RegistrationDocument.belongsTo(MediaAsset, {
  foreignKey: "mediaAssetId",
  as: "asset",
});
RegistrationStatusHistory.belongsTo(StaffAccount, {
  foreignKey: "actorId",
  as: "actor",
});
RegistrationDocument.belongsTo(StaffAccount, {
  foreignKey: "verifiedById",
  as: "verifiedBy",
});
Registration.hasMany(PaymentAllocation, {
  foreignKey: "registrationId",
  as: "paymentAllocations",
});
Payment.belongsToMany(Registration, {
  through: PaymentAllocation,
  as: "registrations",
  foreignKey: "paymentId",
  otherKey: "registrationId",
});
Registration.belongsToMany(Payment, {
  through: PaymentAllocation,
  as: "payments",
  foreignKey: "registrationId",
  otherKey: "paymentId",
});
AttendanceSession.hasMany(AttendanceRecord, {
  foreignKey: "sessionId",
  as: "records",
});
AttendanceRecord.belongsTo(AttendanceSession, {
  foreignKey: "sessionId",
  as: "session",
});
AttendanceSession.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
AttendanceSession.belongsTo(Programme, {
  foreignKey: "programmeId",
  as: "programme",
});
AttendanceSession.belongsTo(StaffAccount, {
  foreignKey: "coachId",
  as: "coach",
});
Player.hasMany(AttendanceRecord, {
  foreignKey: "playerId",
  as: "attendanceRecords",
});
AttendanceRecord.belongsTo(Player, { foreignKey: "playerId", as: "player" });
Player.hasMany(Assessment, { foreignKey: "playerId", as: "assessments" });
Assessment.belongsTo(Player, { foreignKey: "playerId", as: "player" });
Assessment.belongsTo(Registration, {
  foreignKey: "registrationId",
  as: "registration",
});
Assessment.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Assessment.belongsTo(StaffAccount, { foreignKey: "coachId", as: "coach" });
Player.hasMany(ConsentRecord, { foreignKey: "playerId", as: "consents" });
Guardian.hasMany(ConsentRecord, { foreignKey: "guardianId", as: "consents" });
ConsentRecord.belongsTo(MediaAsset, {
  foreignKey: "documentAssetId",
  as: "document",
});
ConsentRecord.belongsTo(Player, { foreignKey: "playerId", as: "player" });
ConsentRecord.belongsTo(Guardian, { foreignKey: "guardianId", as: "guardian" });
Player.hasMany(PlayerSafeguardingRecord, {
  foreignKey: "playerId",
  as: "safeguardingRecords",
});
PlayerSafeguardingRecord.belongsTo(StaffAccount, {
  foreignKey: "createdById",
  as: "createdBy",
});
Payment.belongsTo(StaffAccount, {
  foreignKey: "recordedById",
  as: "recordedBy",
});
Payment.belongsTo(Player, { foreignKey: "playerId", as: "player" });
Payment.belongsTo(Registration, {
  foreignKey: "registrationId",
  as: "registration",
});
Registration.hasMany(Payment, { foreignKey: "registrationId", as: "paymentRecords" });
Payment.belongsTo(Guardian, { foreignKey: "guardianId", as: "guardian" });
Payment.belongsTo(Programme, { foreignKey: "programmeId", as: "programme" });
Payment.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Payment.hasMany(PaymentEvent, { foreignKey: "paymentId", as: "events" });
Payment.hasMany(Refund, { foreignKey: "paymentId", as: "refunds" });
Refund.belongsTo(Payment, { foreignKey: "paymentId", as: "payment" });
Refund.belongsTo(StaffAccount, {
  foreignKey: "requestedById",
  as: "requester",
});
Refund.belongsTo(StaffAccount, { foreignKey: "approvedById", as: "approver" });
Sponsor.hasMany(FundingRecord, {
  foreignKey: "sponsorId",
  as: "fundingRecords",
});
FundingRecord.belongsTo(Sponsor, { foreignKey: "sponsorId", as: "sponsor" });
Sponsor.hasMany(SponsorCommunication, {
  foreignKey: "sponsorId",
  as: "communications",
});
SponsorCommunication.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});
Player.hasMany(ScholarshipApplication, {
  foreignKey: "playerId",
  as: "scholarshipApplications",
});
ScholarshipApplication.belongsTo(Player, {
  foreignKey: "playerId",
  as: "player",
});
ScholarshipApplication.belongsTo(Centre, {
  foreignKey: "centreId",
  as: "centre",
});
ScholarshipApplication.belongsTo(Programme, {
  foreignKey: "programmeId",
  as: "programme",
});
ScholarshipApplication.belongsTo(Assessment, {
  foreignKey: "assessmentId",
  as: "assessment",
});
ScholarshipApplication.hasMany(ScholarshipDocument, {
  foreignKey: "applicationId",
  as: "documents",
});
ScholarshipApplication.hasMany(ScholarshipDecision, {
  foreignKey: "applicationId",
  as: "decisions",
});
ScholarshipDocument.belongsTo(MediaAsset, {
  foreignKey: "mediaAssetId",
  as: "asset",
});
ScholarshipDecision.belongsTo(StaffAccount, {
  foreignKey: "reviewerId",
  as: "reviewer",
});
ScholarshipAward.belongsTo(Player, { foreignKey: "playerId", as: "player" });
ScholarshipAward.belongsTo(ScholarshipApplication, {
  foreignKey: "applicationId",
  as: "application",
});
ScholarshipAward.belongsTo(Programme, {
  foreignKey: "programmeId",
  as: "programme",
});
ScholarshipAward.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
ScholarshipAward.belongsToMany(Sponsor, {
  through: ScholarshipAwardSponsor,
  as: "sponsors",
  foreignKey: "scholarshipAwardId",
  otherKey: "sponsorId",
});
Sponsor.belongsToMany(ScholarshipAward, {
  through: ScholarshipAwardSponsor,
  as: "scholarshipAwards",
  foreignKey: "sponsorId",
  otherKey: "scholarshipAwardId",
});
Season.hasMany(Team, { foreignKey: "seasonId", as: "teams" });
Team.belongsTo(Season, { foreignKey: "seasonId", as: "season" });
Team.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Team.belongsTo(StaffAccount, { foreignKey: "coachId", as: "coach" });
Team.belongsToMany(Player, {
  through: TeamPlayer,
  as: "players",
  foreignKey: "teamId",
  otherKey: "playerId",
});
Player.belongsToMany(Team, {
  through: TeamPlayer,
  as: "teams",
  foreignKey: "playerId",
  otherKey: "teamId",
});
Fixture.belongsTo(Season, { foreignKey: "seasonId", as: "season" });
Fixture.belongsTo(Team, { foreignKey: "homeTeamId", as: "homeTeam" });
Fixture.belongsTo(Team, { foreignKey: "awayTeamId", as: "awayTeam" });
Enquiry.hasMany(FollowUpTask, { foreignKey: "enquiryId", as: "tasks" });
FollowUpTask.belongsTo(Enquiry, { foreignKey: "enquiryId", as: "enquiry" });
FollowUpTask.belongsTo(StaffAccount, {
  foreignKey: "assignedToId",
  as: "assignee",
});
Enquiry.belongsTo(StaffAccount, { foreignKey: "assignedToId", as: "assignee" });
Enquiry.hasMany(EnquiryCommunication, {
  foreignKey: "enquiryId",
  as: "communications",
});
EnquiryCommunication.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});
StaffAccount.hasMany(Notification, {
  foreignKey: "forStaffId",
  as: "notifications",
});
Notification.belongsTo(StaffAccount, {
  foreignKey: "forStaffId",
  as: "recipient",
});
NotificationOutbox.hasMany(NotificationAttempt, {
  foreignKey: "outboxId",
  as: "attempts",
});
NotificationAttempt.belongsTo(NotificationOutbox, {
  foreignKey: "outboxId",
  as: "outbox",
});
NotificationOutbox.belongsTo(StaffAccount, {
  foreignKey: "recipientStaffId",
  as: "recipientStaff",
});
StaffAccount.hasOne(NotificationPreference, {
  foreignKey: "staffAccountId",
  as: "notificationPreferences",
});
NotificationPreference.belongsTo(StaffAccount, {
  foreignKey: "staffAccountId",
  as: "staffAccount",
});
Guardian.hasOne(NotificationPreference, {
  foreignKey: "guardianId",
  as: "notificationPreferences",
});
NotificationPreference.belongsTo(Guardian, {
  foreignKey: "guardianId",
  as: "guardian",
});
SponsorshipEnquiry.belongsTo(StaffAccount, {
  foreignKey: "assignedToId",
  as: "assignee",
});
Story.belongsToMany(MediaAsset, {
  through: StoryMedia,
  as: "media",
  foreignKey: "storyId",
  otherKey: "mediaAssetId",
});
MediaAsset.belongsToMany(Story, {
  through: StoryMedia,
  as: "stories",
  foreignKey: "mediaAssetId",
  otherKey: "storyId",
});
Story.hasMany(StoryApproval, { foreignKey: "storyId", as: "approvals" });
StoryApproval.belongsTo(StaffAccount, {
  foreignKey: "reviewerId",
  as: "reviewer",
});
Story.belongsTo(Centre, { foreignKey: "centreId", as: "centre" });
Story.belongsTo(StaffAccount, { foreignKey: "authorId", as: "author" });
MediaAsset.belongsTo(StaffAccount, { foreignKey: "ownerId", as: "owner" });

export { sequelize };
