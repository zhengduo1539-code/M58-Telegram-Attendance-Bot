import type {
  ActivityKind,
  ActiveActivity,
  ActivityRecord,
  Locale,
  UserProfile,
} from "./types";

type LocaleText = {
  title: string;
  help: string;
  noActive: string;
  alreadyActive: (activity: string) => string;
  started: (
    activity: string,
    time: string,
    occurrence: number,
    limitMinutes: number,
  ) => string;
  settled: (
    activity: string,
    startTime: string,
    duration: string,
    todayActivityTime: string,
    todayTotalTime: string,
    todayCount: number,
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
    "活动开始后请在回座时使用 /back。默认活动时间限制为 15 分钟。",
  ].join("\n"),
  noActive: "当前没有正在进行的活动，无需回座结算。",
  alreadyActive: (activity) =>
    `⚠️ 你正在进行「${activity}」，请先使用 /back 回座后再开始新的活动。`,
  started: (activity, time, occurrence, limitMinutes) =>
    [
      `✅ 打卡成功：${activity} - ${time}`,
      `注意：这是第 ${occurrence} 次 ${activity}`,
      `本次活动时间限制：${limitMinutes} 分钟`,
      "提示：活动完成后请及时打卡回座",
      "回座：/back",
    ].join("\n"),
  settled: (
    activity,
    startTime,
    duration,
    todayActivityTime,
    todayTotalTime,
    todayCount,
  ) =>
    [
      `✅ ${startTime} 回座打卡成功：${activity}`,
      "提示：本次活动时间已结算。",
      `本次活动耗时：${duration}`,
      `${activity} 今日累计时间：${todayActivityTime}`,
      `今日全部活动累计时间：${todayTotalTime}`,
      `今日 ${activity}：${todayCount} 次`,
    ].join("\n"),
  shiftStarted: (time) => `✅ 上班打卡成功：${time}`,
  shiftEnded: (time) => `✅ 下班打卡成功：${time}`,
  languageChanged: "语言已切换为中文。",
  languageUsage: "用法：/lang zh 或 /lang en",
  unknownLanguage: "支持的语言：zh（中文）、en（English）。",
  unknownCommand: "未知命令。请使用 /help 查看可用命令。",
  buttons: { wc: "上厕所", smoke: "抽烟", wcd: "WCD", back: "回座" },
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
    "Use /back when you return. The default activity limit is 15 minutes.",
  ].join("\n"),
  noActive: "You do not have an active activity to settle.",
  alreadyActive: (activity) =>
    `⚠️ You are currently on “${activity}”. Use /back before starting another activity.`,
  started: (activity, time, occurrence, limitMinutes) =>
    [
      `✅ Check-in succeeded: ${activity} - ${time}`,
      `This is your ${occurrence}th ${activity} today`,
      `Activity time limit: ${limitMinutes} minutes`,
      "Please use /back when you return to your seat",
      "Back: /back",
    ].join("\n"),
  settled: (
    activity,
    startTime,
    duration,
    todayActivityTime,
    todayTotalTime,
    todayCount,
  ) =>
    [
      `✅ ${startTime} Return-to-seat succeeded: ${activity}`,
      "This activity has been settled.",
      `Activity duration: ${duration}`,
      `Today's ${activity} time: ${todayActivityTime}`,
      `Total activity time today: ${todayTotalTime}`,
      `Today's ${activity} count: ${todayCount}`,
    ].join("\n"),
  shiftStarted: (time) => `✅ Work check-in succeeded: ${time}`,
  shiftEnded: (time) => `✅ Work check-out succeeded: ${time}`,
  languageChanged: "Language switched to English.",
  languageUsage: "Usage: /lang zh or /lang en",
  unknownLanguage: "Supported languages: zh (中文), en (English).",
  unknownCommand: "Unknown command. Use /help to see available commands.",
  buttons: { wc: "Toilet", smoke: "Smoke", wcd: "WCD", back: "Back" },
};

export const getLocale = (locale: Locale): LocaleText =>
  locale === "en" ? en : zh;

export const activityLabel = (kind: ActivityKind, locale: Locale): string => {
  const labels = {
    zh: { eat: "吃饭", wc: "上厕所", smoke: "抽烟", wcd: "WCD" },
    en: { eat: "Meal", wc: "Toilet", smoke: "Smoke", wcd: "WCD" },
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