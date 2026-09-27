import type { Logger } from "pino";
import type { BotConfig } from "./config";
import { CommandHandler } from "./command-handler";
import { setBotStatus } from "./runtime";
import { TelegramClient } from "./telegram-client";

export class TelegramPollingBot {
  private stopped = false;
  private offset?: number;

  constructor(
    private readonly config: BotConfig,
    private readonly logger: Logger,
    private readonly handler: CommandHandler,
    private readonly telegram: TelegramClient,
  ) {}

  async start() {
    await this.telegram.deleteWebhook();
    await this.telegram.setMyCommands();
    setBotStatus({ enabled: true, running: true, lastError: undefined });
    this.logger.info("Telegram polling started");
    void this.loop();
  }

  stop() {
    this.stopped = true;
    setBotStatus({ running: false });
  }

  private async loop() {
    while (!this.stopped) {
      try {
        const updates = await this.telegram.getUpdates(this.offset, 25);
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handler.handleUpdate(update);
          setBotStatus({ lastUpdateAt: new Date().toISOString(), lastError: undefined });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setBotStatus({ lastError: message, running: true });
        this.logger.error({ err: error }, "Telegram polling failed");
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.pollIntervalMs),
        );
      }
    }
  }
}