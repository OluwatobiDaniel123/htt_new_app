import {
  DataTypes,
  type Model,
  type ModelAttributes,
  type ModelOptions,
  type ModelStatic,
  type Sequelize,
} from "sequelize";

export const defineModel = (
  sequelize: Sequelize,
  modelName: string,
  tableName: string,
  fields: ModelAttributes<Model, Record<string, unknown>>,
  options: Omit<
    ModelOptions,
    "sequelize" | "tableName" | "timestamps" | "underscored"
  > = {},
): ModelStatic<Model> =>
  sequelize.define(
    modelName,
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
      },
      ...fields,
    },
    {
      tableName,
      timestamps: true,
      underscored: true,
      ...options,
    },
  );

export const uuid = () => ({ type: DataTypes.UUID, allowNull: false });
export const optionalUuid = () => ({ type: DataTypes.UUID, allowNull: true });
export const text = (allowNull = true) => ({ type: DataTypes.TEXT, allowNull });
export const string = (length = 255, allowNull = true) => ({
  type: DataTypes.STRING(length),
  allowNull,
});
export const date = (allowNull = true) => ({
  type: DataTypes.DATEONLY,
  allowNull,
});
export const timestamp = (allowNull = true) => ({
  type: DataTypes.DATE,
  allowNull,
});
export const json = (allowNull = false) => ({
  type: DataTypes.JSONB,
  allowNull,
  defaultValue: allowNull ? null : [],
});
