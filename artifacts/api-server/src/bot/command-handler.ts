import type { AttendanceService } from "./attendance-service";
import { activityLabel, getLocale } from "./locales";
import type {
  InlineKeyboardMarkup,
  Locale,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
  UserProfile,
} from "./types";
import { TelegramClient } from "./telegram-client";

type Command = {
  name: string;
  argument?: string;
};

const parseCommand = (text: string): Command | undefined => {
  const match = text.trim().match(/^\/([a-z]+)(?:@\w+)?(?:\s+(.+))?$/i);
  return match
    ? { name: match[1].toLowerCase(), argument: match[2]?.trim().toLowerCase() }
    : undefined;
};

const profileFromUser = (
  message: TelegramMessage,
  locale: Locale,
): Omit<UserProfile, "createdAt" | "updatedAt"> | undefined => {
  if (!message.from || message.from.is_bot) return undefined;
  const displayName = [message.from.first_name, message.from.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    chatId: message.chat.id,
    userId: message.from.id,
    displayName: displayName || message.from.username || String(message.from.id),
    username: message.from.username,
    locale,
  };
};

const keyboard = (locale: Locale): InlineKeyboardMarkup => {
  const text = getLocale(locale).buttons;
  return {
    inline_keyboard: [
      [
        { text: text.wc, callback_data: "activity:wc" },
        { text: text.smoke, callback_data: "activity:smoke" },
        { text: text.wcd, callback_data: "activity:wcd" },
      ],
      [{ text: text.back, callback_data: "activity:back" }],
    ],
  };
};

export class CommandHandler {
  constructor(
    private readonly telegram: TelegramClient,
    private readonly attendance: AttendanceService,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update.callback_query);
      return;
    }
    if (update.message) await this.handleMessage(update.message);
  }

  private async handleMessage(message: TelegramMessage) {
    if (!message.text || !message.from || message.from.is_bot) return;
    const command = parseCommand(message.text);
    if (!command) return;

    const currentLocale = await this.attendance.getLocale(
      message.chat.id,
      message.from.id,
    );
    if (command.name === "lang" || command.name === "language") {
      if (command.argument !== "zh" && command.argument !== "en") {
        await this.telegram.sendMessage(
          message.chat.id,
          command.argument
            ? getLocale(currentLocale).unknownLanguage
            : getLocale(currentLocale).languageUsage,
        );
        return;
      }
      const profile = profileFromUser(message, command.argument);
      if (!profile) return;
      await this.attendance.setLocale(profile, command.argument);
      await this.telegram.sendMessage(
        message.chat.id,
        `${getLocale(command.argument).languageChanged}\n\n${getLocale(command.argument).help}`,
        keyboard(command.argument),
      );
      return;
    }

    const profile = profileFromUser(message, currentLocale);
    if (!profile) return;
    const locale = profile.locale;
    const text = getLocale(locale);
    let response: string | undefined;
    let markup: InlineKeyboardMarkup | undefined;

    switch (command.name) {
      case "start":
      case "help":
        response = text.help;
        markup = keyboard(locale);
        break;
      case "work":
        response = await this.attendance.startShift(profile);
        break;
      case "back":
        response = await this.attendance.settle(profile);
        markup = keyboard(locale);
        break;
      case "eat":
      case "wc":
      case "smoke":
      case "wcd":
        response = await this.attendance.startActivity(profile, command.name);
        markup = keyboard(locale);
        break;
      case "offwork":
        response = await this.attendance.offWork(profile);
        markup = keyboard(locale);
        break;
      default:
        response = text.unknownCommand;
    }
    await this.telegram.sendMessage(message.chat.id, response, markup);
  }

  private async handleCallback(callback: TelegramCallbackQuery) {
    await this.telegram.answerCallbackQuery(callback.id);
    const message = callback.message;
    const action = callback.data?.split(":")[1];
    if (!message || !action || !callback.from || callback.from.is_bot) return;
    const currentLocale = await this.attendance.getLocale(
      message.chat.id,
      callback.from.id,
    );
    const syntheticMessage: TelegramMessage = {
      message_id: message.message_id,
      chat: message.chat,
      from: callback.from,
      text: action === "back" ? "/back" : `/${action}`,
    };
    await this.handleMessage(syntheticMessage);
  }
}

export { keyboard };