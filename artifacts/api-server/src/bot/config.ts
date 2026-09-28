import path from "node:path";
import type { ActivityLimits } from "./types";

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseUserId = (value: string | undefined): number | undefined => {
  const parsed = Number(value?.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseAdminIds = (value: string | undefined): number[] =>
  (value || "")
    .split(",")
    .map((entry) => parseUserId(entry))
    .filter((entry): entry is number => entry !== undefined);

const DEFAULT_ACTIVITY_LIMITS: ActivityLimits = {
  eat: 30,
  wc: 10,
  smoke: 10,
  wcd: 15,
};

export type BotConfig = {
  token?: string;
  pollIntervalMs: number;
  telegramRequestTimeoutMs: number;
  activityLimits: ActivityLimits;
  dataPath: string;
  timeZone: string;
  botOwnerId?: number;
  adminIds: number[];
};

export const getBotConfig = (): BotConfig => ({
  token: process.env["TELEGRAM_BOT_TOKEN"]?.trim() || undefined,
  pollIntervalMs: positiveInteger(process.env["BOT_POLL_INTERVAL_MS"], 1_000),
  telegramRequestTimeoutMs: positiveInteger(
    process.env["BOT_REQUEST_TIMEOUT_MS"],
    40_000,
  ),
  activityLimits: { ...DEFAULT_ACTIVITY_LIMITS },
  dataPath: path.resolve(
    process.env["BOT_DATA_PATH"]?.trim() || "data/m58-bot-state.json",
  ),
  timeZone: "Asia/Rangoon",
  botOwnerId: parseUserId(process.env["BOT_OWNER_ID"]),
  adminIds: parseAdminIds(process.env["ADMIN_IDS"]),
});
