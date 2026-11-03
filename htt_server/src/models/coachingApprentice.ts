import { DataTypes, type Sequelize } from "sequelize";
import { defineModel } from "./defineModel.js";

export const defineCoachingApprenticeModels = (sequelize: Sequelize) => ({
  CoachingApprenticeApplication: defineModel(
    sequelize,
    "CoachingApprenticeApplication",
    "coaching_apprentice_applications",
    {
      fullName: {
        type: DataTypes.STRING(160),
        allowNull: false,
        field: "full_name",
      },
      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "phone_number",
      },
      email: { type: DataTypes.STRING(320), allowNull: false },
      location: { type: DataTypes.STRING(160), allowNull: false },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "pending",
      },
    },
  ),
});
