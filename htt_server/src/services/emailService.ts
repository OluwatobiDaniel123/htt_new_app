import { Resend } from "resend";
import { env } from "../config/env.js";

let resend: Resend | undefined;

export const sendNotificationEmail = async (
  to: string,
  subject: string,
  html: string,
  text: string,
) => {
  if (!env.NOTIFICATIONS_ENABLED)
    return {
      delivered: false,
      retryable: true,
      errorCode: "external_notifications_disabled",
    };
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL)
    return {
      delivered: false,
      retryable: true,
      errorCode: "email_provider_not_configured",
    };
  resend ??= new Resend(env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });
    return error
      ? { delivered: false, retryable: true, errorCode: "email_provider_error" }
      : { delivered: true, providerMessageId: data?.id };
  } catch {
    return {
      delivered: false,
      retryable: true,
      errorCode: "email_provider_unavailable",
    };
  }
};

export const sendPasswordLink = async (
  email: string,
  token: string,
  purpose: "password_reset" | "staff_invite",
) => {
  if (
    env.NODE_ENV === "development" ||
    !env.RESEND_API_KEY ||
    !env.RESEND_FROM_EMAIL
  )
    return false;
  resend ??= new Resend(env.RESEND_API_KEY);
  const link = new URL(env.PASSWORD_RESET_URL);
  link.searchParams.set("token", token);
  const heading =
    purpose === "staff_invite"
      ? "Set up your HTT Academy account"
      : "Reset your HTT Academy password";
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: heading,
    text: `${heading}\n\nUse this one-time link within 30 minutes:\n${link.toString()}\n\nIf you did not request this, ignore this email.`,
  });
  return !error;
};
