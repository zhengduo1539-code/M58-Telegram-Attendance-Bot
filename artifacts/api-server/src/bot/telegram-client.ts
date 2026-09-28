import type {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  TelegramUpdate,
} from "./types";

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export class TelegramClient {
  private readonly baseUrl: string;

  constructor(
    private readonly token: string,
    private readonly requestTimeoutMs: number,
  ) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call<T>(
    method: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Telegram API ${method} timed out after ${this.requestTimeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await response.text();
    let body: TelegramResponse<T>;
    try {
      body = JSON.parse(rawBody) as TelegramResponse<T>;
    } catch {
      throw new Error(
        `Telegram API ${method} returned invalid JSON (HTTP ${response.status})`,
      );
    }

    if (!response.ok || !body.ok) {
      throw new Error(body.description || `Telegram API ${method} failed`);
    }
    return body.result as T;
  }

  getUpdates(offset: number | undefined, timeoutSeconds: number) {
    return this.call<TelegramUpdate[]>("getUpdates", {
      ...(offset === undefined ? {} : { offset }),
      timeout: timeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    });
  }

  sendMessage(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup,
    replyToMessageId?: number,
  ) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      ...(replyToMessageId
        ? {
            reply_parameters: {
              message_id: replyToMessageId,
              allow_sending_without_reply: true,
            },
          }
        : {}),
    });
  }

  answerCallbackQuery(callbackQueryId: string) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
    });
  }

  deleteWebhook() {
    return this.call("deleteWebhook", { drop_pending_updates: false });
  }

  setMyCommands() {
    return this.call("setMyCommands", {
      commands: [
        { command: "work", description: "上班 / Start work" },
        { command: "back", description: "回座 / Return to seat" },
        { command: "eat", description: "吃饭 / Meal break" },
        { command: "wc", description: "上厕所 / Toilet" },
        { command: "smoke", description: "抽烟 / Smoke break" },
        { command: "wcd", description: "WCD" },
        { command: "offwork", description: "下班 / End work" },
        { command: "help", description: "帮助 / Help" },
        { command: "lang", description: "语言 / Language" },
      ],
    });
  }
}
