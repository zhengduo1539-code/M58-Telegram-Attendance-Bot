import type { Logger } from "pino";
import { ActivityReminderScheduler } from "./activity-reminder-scheduler";
import { AttendanceService } from "./attendance-service";
import { CommandHandler } from "./command-handler";
import { getBotConfig } from "./config";
import { TelegramPollingBot } from "./polling";
import { setBotStatus } from "./runtime";
import { FileBotStore } from "./store/file-store";
import { TelegramClient } from "./telegram-client";

const MAX_START_RETRY_DELAY_MS = 30_000;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const startTelegramBot = async (logger: Logger) => {
  const config = getBotConfig();
  if (!config.token) {
    setBotStatus({ enabled: false, running: false });
    logger.warn(
      "TELEGRAM_BOT_TOKEN is not configured; API health endpoint is running but Telegram polling is disabled",
    );
    return undefined;
  }

  setBotStatus({ enabled: true, running: false, lastError: undefined });

  let retryDelayMs = config.pollIntervalMs;
  while (true) {
    try {
      const store = new FileBotStore(config.dataPath);
      const attendance = new AttendanceService(store, config);
      const telegram = new TelegramClient(
        config.token,
        config.telegramRequestTimeoutMs,
      );
      const handler = new CommandHandler(telegram, attendance, config);
      const bot = new TelegramPollingBot(config, logger, handler, telegram);
      await bot.start();
      const reminders = new ActivityReminderScheduler(
        attendance,
        telegram,
        logger,
      );
      reminders.start();
      return bot;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setBotStatus({ enabled: true, running: false, lastError: message });
      logger.error(
        { err: error, retryDelayMs },
        "Telegram bot startup failed; retrying",
      );
      await sleep(retryDelayMs);
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_START_RETRY_DELAY_MS);
    }
  }
};

export { getBotStatus } from "./runtime";
