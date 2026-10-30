import { processOutboxBatch } from "./notificationService.js";

type WorkerTimer = NodeJS.Timeout;
type Schedule = (callback: () => void, intervalMs: number) => WorkerTimer;

interface NotificationWorkerOptions {
  enabled: boolean;
  intervalMs: number;
  processBatch?: () => Promise<unknown>;
  schedule?: Schedule;
}

export function startNotificationOutboxWorker({
  enabled,
  intervalMs,
  processBatch = processOutboxBatch,
  schedule = (callback, delay) => setInterval(callback, delay),
}: NotificationWorkerOptions): WorkerTimer | undefined {
  if (!enabled) return undefined;

  const timer = schedule(() => {
    void processBatch().catch(() =>
      console.error("Notification outbox worker failed."),
    );
  }, intervalMs);
  timer.unref();
  return timer;
}
