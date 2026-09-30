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
  alreadyActive: (
    displayName: string,
    userId: number,
    activity: string,
  ) => string;
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
    limitMinutes: number,
    todayActivitySeconds: number,
    todayTotalSeconds: number,
    todayCounts: Record<ActivityKind, number>,
  ) => string;
  timeoutReminder: (
    displayName: string,
    userId: number,
    activity: string,
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

const inlineCode = (value: string | number): string =>
  `<code>${escapeHtml(String(value))}</code>`;

const divider = inlineCode("--------------------");

const userIdentity = (displayName: string, userId: number) => ({
  name: userLink(displayName, userId),
  id: inlineCode(userId),
});

const formatChineseDuration = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)} 小时 ${pad(minutes)} 分钟 ${pad(seconds)} 秒`
    : `${pad(minutes)} 分钟 ${pad(seconds)} 秒`;
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

const getTimeoutSeconds = (durationSeconds: number, limitMinutes: number) =>
  Math.max(0, Math.floor(durationSeconds - limitMinutes * 60));

const zh: LocaleText = {
  title: "打卡机器人 M58",
  help: [
    "可用命令：",
    `${inlineCode("/work")} — 上班`,
    `${inlineCode("/back")} — 回座并结算当前活动`,
    `${inlineCode("/eat")} — 吃饭`,
    `${inlineCode("/wc")} — 上厕所`,
    `${inlineCode("/smoke")} — 抽烟`,
    `${inlineCode("/wcd")} — WCD`,
    `${inlineCode("/offwork")} — 下班`,
    `${inlineCode("/lang en")} — 切换英文`,
    `${inlineCode("/lang zh")} — 切换中文`,
    "",
    `活动开始后请在回座时使用 ${inlineCode("/back")}。`,
  ].join("\n"),
  noActive: "当前没有正在进行的活动，无需回座结算。",
  alreadyActive: (displayName, userId, activity) => {
    const identity = userIdentity(displayName, userId);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      divider,
      `状态：❌ ${inlineCode("打卡失败！")}`,
      `原因：你正在进行的活动，${inlineCode(activity)}`,
      divider,
      `提示：${inlineCode("进行其他活动前，请先回座")}`,
      divider,
      `回座：${inlineCode("/back")}`,
    ].join("\n");
  },
  started: (displayName, userId, activity, time, occurrence, limitMinutes) => {
    const identity = userIdentity(displayName, userId);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      `✅ 打卡成功：${inlineCode(activity)} - ${inlineCode(time)}`,
      `注意：这是第 ${inlineCode(occurrence)} 次${inlineCode(activity)}`,
      `本次活动时间限制：${inlineCode(`${limitMinutes} 分钟`)}`,
      "提示：活动完成后请及时打卡回座",
      `回座：${inlineCode("/back")}`,
    ].join("\n");
  },
  settled: (
    displayName,
    userId,
    activity,
    startTime,
    durationSeconds,
    limitMinutes,
    todayActivitySeconds,
    todayTotalSeconds,
    todayCounts,
  ) => {
    const identity = userIdentity(displayName, userId);
    const timeoutSeconds = getTimeoutSeconds(durationSeconds, limitMinutes);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      `✅ ${inlineCode(startTime)} 回座打卡成功：${inlineCode(activity)}`,
      "提示：本次活动时间已结算。",
      `本次活动耗时：${inlineCode(formatChineseDuration(durationSeconds))}`,
      `今日累计${inlineCode(activity)}时间：${inlineCode(formatChineseDuration(todayActivitySeconds))}`,
      `今日累计活动总时间：${inlineCode(formatChineseDuration(todayTotalSeconds))}`,
      ...(timeoutSeconds > 0
        ? [
            "⚠️ 警告：本次活动已超时！",
            `超时时间：${inlineCode(formatChineseDuration(timeoutSeconds))}`,
          ]
        : []),
      divider,
      ...(["wc", "smoke", "wcd", "eat"] as ActivityKind[])
        .filter((kind) => todayCounts[kind] > 0)
        .map(
          (kind) =>
            `本日${activityLabel(kind, "zh")}：${inlineCode(`${todayCounts[kind]} 次`)}`,
        ),
    ].join("\n");
  },
  timeoutReminder: (displayName, userId, activity) => {
    const identity = userIdentity(displayName, userId);
    return [
      `用户：${identity.name}`,
      `用户标识：${identity.id}`,
      `⚠️ 警告：您本次${inlineCode(activity)}已超时，请尽快回座！`,
      `回座：${inlineCode("/back")}`,
    ].join("\n");
  },
  shiftStarted: (time) => `✅ 上班打卡成功：${inlineCode(time)}`,
  shiftEnded: (time) => `✅ 下班打卡成功：${inlineCode(time)}`,
  languageChanged: "语言已切换为中文。",
  languageUsage: "用法：/lang zh 或 /lang en（/lang eng 也可以）",
  unknownLanguage: "支持的语言：zh（中文）、en/eng（English）。",
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
      `吃饭 / eat：${inlineCode(`${limits.eat} 分钟`)}`,
      `上厕所 / wc：${inlineCode(`${limits.wc} 分钟`)}`,
      `抽烟 / smoke：${inlineCode(`${limits.smoke} 分钟`)}`,
      `WCD / wcd：${inlineCode(`${limits.wcd} 分钟`)}`,
    ].join("\n"),
  limitUpdated: (activity, minutes) =>
    `✅ 已将 ${inlineCode(activity)} 的活动时间限制设置为 ${inlineCode(`${minutes} 分钟`)}。`,
};

const en: LocaleText = {
  title: "Attendance Bot M58",
  help: [
    "Available commands:",
    `${inlineCode("/work")} — Start work`,
    `${inlineCode("/back")} — Return to seat and settle activity`,
    `${inlineCode("/eat")} — Meal break`,
    `${inlineCode("/wc")} — Toilet`,
    `${inlineCode("/smoke")} — Smoke break`,
    `${inlineCode("/wcd")} — WCD`,
    `${inlineCode("/offwork")} — End work`,
    `${inlineCode("/lang en")} — Switch to English`,
    `${inlineCode("/lang zh")} — Switch to Chinese`,
    "",
    `Use ${inlineCode("/back")} when you return.`,
  ].join("\n"),
  noActive: "You do not have an active activity to settle.",
  alreadyActive: (displayName, userId, activity) => {
    const identity = userIdentity(displayName, userId);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      divider,
      `Status: ❌ ${inlineCode("Check-In Failed!")}`,
      `Reason: You have an ongoing activity, ${inlineCode(activity)}`,
      divider,
      `Hint: ${inlineCode("Please Back to Seat before engaging in other activities.")}`,
      divider,
      `Back to Seat: ${inlineCode("/back")}`,
    ].join("\n");
  },
  started: (displayName, userId, activity, time, occurrence, limitMinutes) => {
    const identity = userIdentity(displayName, userId);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      divider,
      `✅ Check-In Succeeded: ${inlineCode(activity)} - ${inlineCode(time)}`,
      `Attention: This is your ${inlineCode(`${occurrence} time ${activity}`)}.`,
      divider,
      `Time Limit for This Activity: ${inlineCode(`${limitMinutes} minute`)}`,
      divider,
      "Tip: Please check in Back to seat after completing the activity.",
      divider,
      `Back to Seat: ${inlineCode("/back")}`,
    ].join("\n");
  },
  settled: (
    displayName,
    userId,
    activity,
    startTime,
    durationSeconds,
    limitMinutes,
    todayActivitySeconds,
    todayTotalSeconds,
    todayCounts,
  ) => {
    const identity = userIdentity(displayName, userId);
    const timeoutSeconds = getTimeoutSeconds(durationSeconds, limitMinutes);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      divider,
      `✅ ${inlineCode(startTime)} Back to Seat Check-In Succeeded: ${inlineCode(activity)}`,
      divider,
      "Hint: This activity's time has been settled.",
      divider,
      `Time Used for This Activity: ${inlineCode(formatEnglishDuration(durationSeconds))}`,
      divider,
      `Total ${inlineCode(activity)} time today: ${inlineCode(formatEnglishDuration(todayActivitySeconds))}`,
      `Total time for all activities today: ${inlineCode(formatEnglishDuration(todayTotalSeconds))}`,
      ...(timeoutSeconds > 0
        ? [
            "⚠️ Warning: You have exceeded the time limit for this activity!",
            `Timeout duration for Activity: ${inlineCode(formatEnglishDuration(timeoutSeconds))}`,
          ]
        : []),
      divider,
      ...(["wc", "smoke", "wcd", "eat"] as ActivityKind[])
        .filter((kind) => todayCounts[kind] > 0)
        .map(
          (kind) =>
            `Today's ${activityLabel(kind, "en")}: ${inlineCode(`${todayCounts[kind]} times`)}`,
        ),
    ].join("\n");
  },
  timeoutReminder: (displayName, userId, activity) => {
    const identity = userIdentity(displayName, userId);
    return [
      `User: ${identity.name}`,
      `User ID: ${identity.id}`,
      `⚠️ Warning: Your ${inlineCode(activity)} activity is overdue. Please return to your seat.`,
      `Back to Seat: ${inlineCode("/back")}`,
    ].join("\n");
  },
  shiftStarted: (time) => `✅ Work check-in succeeded: ${inlineCode(time)}`,
  shiftEnded: (time) => `✅ Work check-out succeeded: ${inlineCode(time)}`,
  languageChanged: "Language switched to English.",
  languageUsage: "Usage: /lang zh or /lang en (/lang eng also works)",
  unknownLanguage: "Supported languages: zh (中文), en/eng (English).",
  unknownCommand: "Unknown command. Use /help to see available commands.",
  buttons: { wc: "Toilet", smoke: "Smoke", wcd: "WCD", back: "Back" },
  adminOnly: "This command is only available to the bot owner/admins.",
  limitPrivate: "Please use this command in the bot private chat.",
  limitUsage:
    "Usage: /limit <eat|wc|smoke|wcd> <minutes>, for example: /limit wc 10",
  unknownActivity: "Supported activities: eat, wc, smoke, wcd.",
  invalidLimit: "Minutes must be a positive integer.",
  limits: (limits) =>
    [
      "Current activity limits:",
      `Meal / eat: ${inlineCode(`${limits.eat} minutes`)}`,
      `Toilet / wc: ${inlineCode(`${limits.wc} minutes`)}`,
      `Smoke / smoke: ${inlineCode(`${limits.smoke} minutes`)}`,
      `WCD / wcd: ${inlineCode(`${limits.wcd} minutes`)}`,
    ].join("\n"),
  limitUpdated: (activity, minutes) =>
    `✅ ${inlineCode(activity)} activity limit set to ${inlineCode(`${minutes} minutes`)}.`,
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
): string =>
  user.username ? `${user.displayName} (@${user.username})` : user.displayName;

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
      ? Math.max(
          0,
          Math.floor((endMs - new Date(active.startedAt).getTime()) / 1000),
        )
      : 0;
  return {
    count: completed.length + (active?.kind === kind ? 1 : 0),
    seconds:
      completed.reduce((total, record) => total + record.elapsedSeconds, 0) +
      activeSeconds,
  };
};
