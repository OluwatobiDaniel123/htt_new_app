import { DataTypes, type Sequelize } from "sequelize";
import { defineModel, optionalUuid } from "./defineModel.js";

export const defineContentModels = (sequelize: Sequelize) => ({
  MediaAsset: defineModel(sequelize, "MediaAsset", "media_assets", {
    ownerId: { ...optionalUuid(), field: "owner_id" },
    storageProvider: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "cloudinary",
      field: "storage_provider",
    },
    providerAssetId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: "provider_asset_id",
    },
    secureUrl: { type: DataTypes.TEXT, allowNull: false, field: "secure_url" },
    resourceType: {
      type: DataTypes.STRING(24),
      allowNull: false,
      field: "resource_type",
    },
    mimeType: { type: DataTypes.STRING(120), field: "mime_type" },
    byteSize: { type: DataTypes.BIGINT, field: "byte_size" },
    originalName: { type: DataTypes.STRING(255), field: "original_name" },
    access: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "private",
    },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }),
  Story: defineModel(sequelize, "Story", "stories", {
    title: { type: DataTypes.STRING(220), allowNull: false },
    category: { type: DataTypes.STRING(50), allowNull: false },
    description: DataTypes.TEXT,
    centreId: { ...optionalUuid(), field: "centre_id" },
    publicationDate: { type: DataTypes.DATEONLY, field: "publication_date" },
    authorId: { ...optionalUuid(), field: "author_id" },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "draft",
    },
    involvesChildren: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "involves_children",
    },
    safeguardingApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "safeguarding_approved",
    },
    safeguardingNotes: { type: DataTypes.TEXT, field: "safeguarding_notes" },
  }),
  StoryMedia: defineModel(sequelize, "StoryMedia", "story_media", {
    storyId: { type: DataTypes.UUID, allowNull: false, field: "story_id" },
    mediaAssetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "media_asset_id",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    caption: DataTypes.TEXT,
  }),
  StoryApproval: defineModel(sequelize, "StoryApproval", "story_approvals", {
    storyId: { type: DataTypes.UUID, allowNull: false, field: "story_id" },
    reviewerId: { ...optionalUuid(), field: "reviewer_id" },
    decision: { type: DataTypes.STRING(24), allowNull: false },
    note: DataTypes.TEXT,
  }),
});
