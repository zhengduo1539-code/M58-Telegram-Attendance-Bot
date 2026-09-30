export type Locale = "zh" | "en";

export type ActivityKind = "eat" | "wc" | "smoke" | "wcd";

export type ActivityLimits = Record<ActivityKind, number>;

export type UserProfile = {
  chatId: number;
  userId: number;
  displayName: string;
  username?: string;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
};

export type ActivityRecord = {
  id: string;
  chatId: number;
  userId: number;
  displayName: string;
  kind: ActivityKind;
  startedAt: string;
  endedAt: string;
  elapsedSeconds: number;
  settledBy: "back" | "offwork";
};

export type ActiveActivity = {
  chatId: number;
  userId: number;
  displayName: string;
  kind: ActivityKind;
  startedAt: string;
  limitMinutes: number;
  reminderClaimedAt?: string;
  reminderSentAt?: string;
};

export type BotState = {
  users: Record<string, UserProfile>;
  activeActivities: Record<string, ActiveActivity>;
  records: ActivityRecord[];
  activityLimits?: Partial<ActivityLimits>;
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type?: string;
  title?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  date?: number;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type ReplyKeyboardButton = {
  text: string;
  style?: "danger" | "success" | "primary";
};

export type ReplyKeyboardMarkup = {
  keyboard: ReplyKeyboardButton[][];
  resize_keyboard?: boolean;
  is_persistent?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
};
