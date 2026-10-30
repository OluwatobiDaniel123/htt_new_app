import { app } from "./app.js";
import { env } from "./config/env.js";
import { startNotificationOutboxWorker } from "./services/notificationWorker.js";

export const server = app.listen(env.PORT, () => {
  console.info(
    `HTT Academy API listening on port ${env.PORT} (${env.NODE_ENV}).`,
  );
});

const notificationWorker =
  env.NODE_ENV === "test"
    ? undefined
    : startNotificationOutboxWorker({
        enabled: env.NOTIFICATIONS_ENABLED,
        intervalMs: env.NOTIFICATION_WORKER_INTERVAL_MS,
      });

const shutdown = (signal: NodeJS.Signals) => {
  if (notificationWorker) clearInterval(notificationWorker);
  console.info(`${signal} received; closing HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error("Failed to close HTTP server cleanly:", error);
      process.exitCode = 1;
      return;
    }
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
