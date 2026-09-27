import path from "node:path";

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export type BotConfig = {
  token?: string;
  pollIntervalMs: number;
  activityLimitMinutes: number;
  dataPath: string;
  timeZone: string;
};

export const getBotConfig = (): BotConfig => ({
  token: process.env["TELEGRAM_BOT_TOKEN"]?.trim() || undefined,
  pollIntervalMs: positiveInteger(process.env["BOT_POLL_INTERVAL_MS"], 1_000),
  activityLimitMinutes: positiveInteger(
    process.env["ACTIVITY_LIMIT_MINUTES"],
    15,
  ),
  dataPath: path.resolve(
    process.env["BOT_DATA_PATH"]?.trim() || "data/m58-bot-state.json",
  ),
  timeZone: process.env["BOT_TIME_ZONE"]?.trim() || "Asia/Rangoon",
});