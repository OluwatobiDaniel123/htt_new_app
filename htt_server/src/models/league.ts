import { DataTypes, type Sequelize } from "sequelize";
import { defineModel, optionalUuid } from "./defineModel.js";

export const defineLeagueModels = (sequelize: Sequelize) => ({
  Season: defineModel(sequelize, "Season", "seasons", {
    name: { type: DataTypes.STRING(160), allowNull: false },
    code: { type: DataTypes.STRING(40), unique: true },
    ageCategories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      field: "age_categories",
    },
    startDate: { type: DataTypes.DATEONLY, field: "start_date" },
    endDate: { type: DataTypes.DATEONLY, field: "end_date" },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "planned",
    },
    pointsWin: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      field: "points_win",
    },
    pointsDraw: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: "points_draw",
    },
    pointsLoss: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "points_loss",
    },
    notes: DataTypes.TEXT,
  }),
  Team: defineModel(sequelize, "Team", "teams", {
    name: { type: DataTypes.STRING(160), allowNull: false },
    seasonId: { type: DataTypes.UUID, allowNull: false, field: "season_id" },
    centreId: { ...optionalUuid(), field: "centre_id" },
    ageCategory: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: "age_category",
    },
    coachId: { ...optionalUuid(), field: "coach_id" },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "planned",
    },
  }),
  TeamPlayer: defineModel(sequelize, "TeamPlayer", "team_players", {
    teamId: { type: DataTypes.UUID, allowNull: false, field: "team_id" },
    playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
    jerseyNumber: { type: DataTypes.INTEGER, field: "jersey_number" },
    joinedAt: { type: DataTypes.DATEONLY, field: "joined_at" },
  }),
  Fixture: defineModel(sequelize, "Fixture", "fixtures", {
    seasonId: { ...optionalUuid(), field: "season_id" },
    ageCategory: { type: DataTypes.STRING(40), field: "age_category" },
    homeTeamId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "home_team_id",
    },
    homeTeamName: { type: DataTypes.STRING(160), field: "home_team_name" },
    awayTeamName: { type: DataTypes.STRING(160), field: "away_team_name" },
    seasonName: { type: DataTypes.STRING(160), field: "season_name" },
    awayTeamId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "away_team_id",
    },
    matchDate: { type: DataTypes.DATE, allowNull: false, field: "match_date" },
    venue: DataTypes.STRING(200),
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "scheduled",
    },
    homeScore: { type: DataTypes.INTEGER, field: "home_score" },
    awayScore: { type: DataTypes.INTEGER, field: "away_score" },
    matchReport: { type: DataTypes.TEXT, field: "match_report" },
  }),
});
