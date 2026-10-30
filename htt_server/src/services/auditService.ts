import type { Transaction } from "sequelize";
import { models } from "../models/index.js";

interface AuditInput {
  actorId?: string | null;
  action: string;
  entityName: string;
  recordId?: string | null;
  outcome?: "success" | "failure";
  reason?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  transaction?: Transaction;
}

export const writeAudit = async (input: AuditInput) => {
  try {
    await models.AuditLog.create(
      {
        actorId: input.actorId || null,
        action: input.action,
        entityName: input.entityName,
        recordId: input.recordId || null,
        details: input.details || [input.outcome, input.reason].filter(Boolean).join(":"),
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent?.slice(0, 500) || null,
      },
      { transaction: input.transaction },
    );
  } catch {
    if (input.transaction)
      throw new Error("Audit record could not be committed.");
    // Authentication responses never include or log audit-write errors or credentials.
  }
};
