import { AppError } from "../errors/AppError.js";
import { coachingApprenticeApplication } from "../models/index.js";
import type { CoachingApprenticeApplicationInput } from "../validation/coachingApprenticeSchemas.js";
import { writeAudit } from "./auditService.js";

const unavailableError = () =>
  new AppError(
    503,
    "RECRUITMENT_STORAGE_UNAVAILABLE",
    "Recruitment applications are temporarily unavailable.",
  );

interface CoachingApprenticeRecord {
  id: string;
  status: string;
  createdAt: Date;
  update(values: { status: string }): Promise<unknown>;
}

const isMissingRecruitmentTable = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const dbError = error as {
    original?: { code?: string; message?: string };
    parent?: { code?: string; message?: string };
  };
  const code = dbError.original?.code ?? dbError.parent?.code;
  const message = dbError.original?.message ?? dbError.parent?.message ?? "";
  return code === "42P01" && /coaching_apprentice_applications/i.test(message);
};

const withMissingTableHandling = async <T>(operation: () => Promise<T>) => {
  try {
    return await operation();
  } catch (error) {
    if (isMissingRecruitmentTable(error)) throw unavailableError();
    throw error;
  }
};

export const submitCoachingApprenticeApplication = async (
  input: CoachingApprenticeApplicationInput,
  ip?: string,
  userAgent?: string,
) =>
  withMissingTableHandling(async () => {
    const application = (await coachingApprenticeApplication.create({
      ...input,
      status: "pending",
    })) as unknown as CoachingApprenticeRecord;
    await writeAudit({
      action: "coaching_apprentice.application_submitted",
      entityName: "CoachingApprenticeApplication",
      recordId: application.id,
      ipAddress: ip,
      userAgent,
    });
    return {
      id: application.id,
      status: application.status,
      createdAt: application.createdAt,
    };
  });

export const listCoachingApprenticeApplications = async (query: {
  page: number;
  limit: number;
  status?: string;
}) =>
  withMissingTableHandling(async () => {
    const result = await coachingApprenticeApplication.findAndCountAll({
      where: query.status ? { status: query.status } : undefined,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    return {
      items: result.rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.count,
        totalPages: Math.ceil(result.count / query.limit),
      },
    };
  });

export const getCoachingApprenticeApplication = async (id: string) =>
  withMissingTableHandling(async () => {
    const application = (await coachingApprenticeApplication.findByPk(
      id,
    )) as unknown as CoachingApprenticeRecord | null;
    if (!application)
      throw new AppError(
        404,
        "NOT_FOUND",
        "Coaching apprentice application was not found.",
      );
    return application;
  });

export const updateCoachingApprenticeApplicationStatus = async (
  id: string,
  status: string,
  actorId: string,
  ip?: string,
  userAgent?: string,
) =>
  withMissingTableHandling(async () => {
    const application = (await coachingApprenticeApplication.findByPk(
      id,
    )) as unknown as CoachingApprenticeRecord | null;
    if (!application)
      throw new AppError(
        404,
        "NOT_FOUND",
        "Coaching apprentice application was not found.",
      );

    const previousStatus = application.status;
    await application.update({ status });
    await writeAudit({
      actorId,
      action: "coaching_apprentice.application_status_changed",
      entityName: "CoachingApprenticeApplication",
      recordId: application.id,
      details: `${previousStatus}->${status}`,
      ipAddress: ip,
      userAgent,
    });
    return application;
  });

