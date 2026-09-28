import type {
  ActivityKind,
  ActiveActivity,
  ActivityRecord,
  ActivityLimits,
  Locale,
  UserProfile,
} from "./types";

type LocaleText = {
  title: string;
  help: string;
  noActive: string;
  alreadyActive: (activity: string) => string;
  started: (
    displayName: string,
    userId: number,
    activity: string,
    time: string,
    occurrence: number,
    limitMinutes: number,
  ) => string;
  settled: (
    displayName: string,
    userId: number,
    activity: string,
    startTime: string,
    durationSeconds: number,
    todayActivitySeconds: number,
    todayTotalSeconds: number,
    todayCounts: Record<ActivityKind, number>,
  ) => string;
  shiftStarted: (time: string) => string;
  shiftEnded: (time: string) => string;
  languageChanged: string;
  languageUsage: string;
  unknownLanguage: string;
  unknownCommand: string;
  buttons: {
    wc: string;
    smoke: string;
    wcd: string;
    back: string;
  };
  adminOnly: string;
  limitPrivate: string;
  limitUsage: string;
  unknownActivity: string;
  invalidLimit: string;
  limits: (limits: ActivityLimits) => string;
  limitUpdated: (activity: string, minutes: number) => string;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const userLink = (text: string, userId: number): string =>
  `<a href="tg://user?id=${userId}">${escapeHtml(text)}</a>`;

const userIdentity = (displayName: string, userId: number) => ({
  name: userLink(displayName, userId),
  id: userLink(String(userId), userId),
});

const formatChineseDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours} 小时 ${minutes} 分钟 ${seconds} 秒`
    : `${minutes} 分钟 ${seconds} 秒`;
};

const formatEnglishDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const zh: LocaleText = {
  title: "打卡机器人 M58",
  help: [
    "可用命令：",
    "/work — 上班",
    "/back — 回座并结算当前活动",
    "/eat — 吃饭",
    "/wc — 上厕所",
    "/smoke — 抽烟",
    "/wcd — WCD",
    "/offwork — 下班",
    "/lang en — 切换英文",
    "/lang zh — 切换中文",
    "",
    "活动开始后请在回座时使用 /back。",
  ].join("\n"),
  noActive: "当前没有正在进行的活动，无需回座结算。",
  alreadyActive: (activity) =>
    `⚠️ 你正在进行「${activity}」，请先使用 /back 回座后再开始新的活动。`,
  started: (displayName, userId, activity, time, occurrence, limitMinutes) => {
    const identity = userIdentity(displayName, userId);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      `✅ 打卡成功：${activity} - ${time}`,
      `注意：这是第 ${occurrence} 次${activity}`,
      `本次活动时间限制：${limitMinutes} 分钟`,
      "提示：活动完成后请及时打卡回座",
      "回座：/back",
    ].join("\n");
  },
  settled: (
    displayName,
    userId,
    activity,
    startTime,
    durationSeconds,
    todayActivitySeconds,
    todayTotalSeconds,
    todayCounts,
  ) => {
    const identity = userIdentity(displayName, userId);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      `✅ ${startTime} 回座打卡成功：${activity}`,
      "提示：本次活动时间已结算。",
      `本次活动耗时：${formatChineseDuration(durationSeconds)}`,
      `今日累计${activity}时间：${formatChineseDuration(todayActivitySeconds)}`,
      `今日累计活动总时间：${formatChineseDuration(todayTotalSeconds)}`,
      "--------------------",
      ...(["wc", "smoke", "wcd", "eat"] as ActivityKind[])
        .filter((kind) => todayCounts[kind] > 0)
        .map(
          (kind) =>
            `本日${activityLabel(kind, "zh")}：${todayCounts[kind]} 次`,
        ),
    ].join("\n");
  },
  shiftStarted: (time) => `✅ 上班打卡成功：${time}`,
  shiftEnded: (time) => `✅ 下班打卡成功：${time}`,
  languageChanged: "语言已切换为中文。",
  languageUsage: "用法：/lang zh 或 /lang en",
  unknownLanguage: "支持的语言：zh（中文）、en（English）。",
  unknownCommand: "未知命令。请使用 /help 查看可用命令。",
  buttons: { wc: "上厕所", smoke: "抽烟", wcd: "WCD", back: "回座" },
  adminOnly: "此命令仅限 Bot owner/admin 使用。",
  limitPrivate: "请在 Bot 私聊中使用此命令。",
  limitUsage: "用法：/limit <eat|wc|smoke|wcd> <分钟数>，例如：/limit wc 10",
  unknownActivity: "支持的 activity：eat、wc、smoke、wcd。",
  invalidLimit: "分钟数必须是大于 0 的整数。",
  limits: (limits) =>
    [
      "当前活动时间限制：",
      `吃饭 / eat：${limits.eat} 分钟`,
      `上厕所 / wc：${limits.wc} 分钟`,
      `抽烟 / smoke：${limits.smoke} 分钟`,
      `WCD / wcd：${limits.wcd} 分钟`,
    ].join("\n"),
  limitUpdated: (activity, minutes) =>
    `✅ 已将 ${activity} 的活动时间限制设置为 ${minutes} 分钟。`,
};

const en: LocaleText = {
  title: "Attendance Bot M58",
  help: [
    "Available commands:",
    "/work — Start work",
    "/back — Return to seat and settle activity",
    "/eat — Meal break",
    "/wc — Toilet",
    "/smoke — Smoke break",
    "/wcd — WCD",
    "/offwork — End work",
    "/lang en — Switch to English",
    "/lang zh — Switch to Chinese",
    "",
    "Use /back when you return.",
  ].join("\n"),
  noActive: "You do not have an active activity to settle.",
  alreadyActive: (activity) =>
    `⚠️ You are currently on “${activity}”. Use /back before starting another activity.`,
  started: (displayName, userId, activity, time, occurrence, limitMinutes) => {
    const identity = userIdentity(displayName, userId);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      `✅ Check-In Succeeded: ${activity} - ${time}`,
      `This is your ${occurrence}th ${activity} today`,
      `Activity time limit: ${limitMinutes} minutes`,
      "Hint: Please check in when the activity is completed",
      "Back to Seat: /back",
    ].join("\n");
  },
  settled: (
    displayName,
    userId,
    activity,
    startTime,
    durationSeconds,
    todayActivitySeconds,
    todayTotalSeconds,
    todayCounts,
  ) => {
    const identity = userIdentity(displayName, userId);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      `✅ ${startTime} Back to Seat Check-In Succeeded: ${activity}`,
      "Hint: This activity's time has been settled.",
      "--------------------",
      `Time Used for This Activity: ${formatEnglishDuration(durationSeconds)}`,
      "--------------------",
      `Total ${activity} time today: ${formatEnglishDuration(todayActivitySeconds)}`,
      `Total time for all activities today: ${formatEnglishDuration(todayTotalSeconds)}`,
      "--------------------",
      ...(["wc", "smoke", "wcd", "eat"] as ActivityKind[])
        .filter((kind) => todayCounts[kind] > 0)
        .map(
          (kind) =>
            `Today's ${activityLabel(kind, "en")}: ${todayCounts[kind]} times`,
        ),
    ].join("\n");
  },
  shiftStarted: (time) => `✅ Work check-in succeeded: ${time}`,
  shiftEnded: (time) => `✅ Work check-out succeeded: ${time}`,
  languageChanged: "Language switched to English.",
  languageUsage: "Usage: /lang zh or /lang en",
  unknownLanguage: "Supported languages: zh (中文), en (English).",
  unknownCommand: "Unknown command. Use /help to see available commands.",
  buttons: { wc: "Toilet", smoke: "Smoke", wcd: "WCD", back: "Back" },
  adminOnly: "This command is only available to the bot owner/admins.",
  limitPrivate: "Please use this command in the bot private chat.",
  limitUsage: "Usage: /limit <eat|wc|smoke|wcd> <minutes>, for example: /limit wc 10",
  unknownActivity: "Supported activities: eat, wc, smoke, wcd.",
  invalidLimit: "Minutes must be a positive integer.",
  limits: (limits) =>
    [
      "Current activity limits:",
      `Meal / eat: ${limits.eat} minutes`,
      `Toilet / wc: ${limits.wc} minutes`,
      `Smoke / smoke: ${limits.smoke} minutes`,
      `WCD / wcd: ${limits.wcd} minutes`,
    ].join("\n"),
  limitUpdated: (activity, minutes) =>
    `✅ ${activity} activity limit set to ${minutes} minutes.`,
};

export const getLocale = (locale: Locale): LocaleText =>
  locale === "en" ? en : zh;

export const activityLabel = (kind: ActivityKind, locale: Locale): string => {
  const labels = {
    zh: { eat: "吃饭", wc: "上厕所", smoke: "抽烟", wcd: "WCD" },
    en: { eat: "Meal", wc: "Toilet", smoke: "Smoke", wcd: "Big toilet" },
  };
  return labels[locale][kind];
};

export const helpText = (locale: Locale): string => getLocale(locale).help;

export const formatUserLine = (
  user: Pick<UserProfile, "displayName" | "username">,
): string => (user.username ? `${user.displayName} (@${user.username})` : user.displayName);

export type ActivitySummary = {
  count: number;
  seconds: number;
};

export const summarizeActivity = (
  records: ActivityRecord[],
  active: ActiveActivity | undefined,
  kind: ActivityKind,
  dayStart: string,
  now: Date,
): ActivitySummary => {
  const startMs = new Date(dayStart).getTime();
  const endMs = now.getTime();
  const completed = records.filter(
    (record) =>
      record.kind === kind &&
      new Date(record.endedAt).getTime() >= startMs &&
      new Date(record.endedAt).getTime() <= endMs,
  );
  const activeSeconds =
    active && active.kind === kind
      ? Math.max(0, Math.floor((endMs - new Date(active.startedAt).getTime()) / 1000))
      : 0;
  return {
    count: completed.length + (active?.kind === kind ? 1 : 0),
    seconds:
      completed.reduce((total, record) => total + record.elapsedSeconds, 0) +
      activeSeconds,
  };
};