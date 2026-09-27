import type { Logger } from "pino";
import { AttendanceService } from "./attendance-service";
import { CommandHandler } from "./command-handler";
import { getBotConfig } from "./config";
import { TelegramPollingBot } from "./polling";
import { setBotStatus } from "./runtime";
import { FileBotStore } from "./store/file-store";
import { TelegramClient } from "./telegram-client";

export const startTelegramBot = async (logger: Logger) => {
  const config = getBotConfig();
  if (!config.token) {
    setBotStatus({ enabled: false, running: false });
    logger.warn(
      "TELEGRAM_BOT_TOKEN is not configured; API health endpoint is running but Telegram polling is disabled",
    );
    return undefined;
  }

  const store = new FileBotStore(config.dataPath);
  const attendance = new AttendanceService(store, config);
  const telegram = new TelegramClient(config.token);
  const handler = new CommandHandler(telegram, attendance);
  const bot = new TelegramPollingBot(config, logger, handler, telegram);
  await bot.start();
  return bot;
};

export { getBotStatus } from "./runtime";