import type { BotConfig } from "./config";
import { activityLabel, getLocale, type ActivitySummary } from "./locales";
import type {
  ActivityKind,
  ActiveActivity,
  ActivityLimits,
  BotState,
  Locale,
  UserProfile,
} from "./types";
import type { BotStore } from "./store/types";

const trackedActivities: ActivityKind[] = ["eat", "wc", "smoke", "wcd"];
const REMINDER_GRACE_MS = 45_000;
const REMINDER_CLAIM_LEASE_MS = 60_000;

const userKey = (chatId: number, userId: number) => `${chatId}:${userId}`;

export type ActivityReminderClaim = {
  activity: ActiveActivity;
  locale: Locale;
  claimedAt: string;
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const localDateKey = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
};

const formatDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const ensureProfile = (
  state: BotState,
  profile: Omit<UserProfile, "createdAt" | "updatedAt">,
  now: string,
) => {
  const key = userKey(profile.chatId, profile.userId);
  const existing = state.users[key];
  state.users[key] = {
    ...profile,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return state.users[key];
};

export class AttendanceService {
  constructor(
    private readonly store: BotStore,
    private readonly config: BotConfig,
  ) {}

  async setLocale(
    profile: Omit<UserProfile, "createdAt" | "updatedAt">,
    locale: Locale,
  ) {
    await this.store.update((state) => {
      const now = new Date().toISOString();
      ensureProfile(state, { ...profile, locale }, now);
    });
  }

  async getLocale(chatId: number, userId: number): Promise<Locale> {
    const state = await this.store.load();
    return state.users[userKey(chatId, userId)]?.locale || "zh";
  }

  async startShift(profile: Omit<UserProfile, "createdAt" | "updatedAt">) {
    const now = new Date();
    await this.store.update((state) => {
      ensureProfile(state, profile, now.toISOString());
    });
    return getLocale(profile.locale).shiftStarted(
      formatDateTime(now, this.config.timeZone),
    );
  }

  async startActivity(
    profile: Omit<UserProfile, "createdAt" | "updatedAt">,
    kind: ActivityKind,
  ) {
    const now = new Date();
    const key = userKey(profile.chatId, profile.userId);
    let response = "";
    await this.store.update((state) => {
      ensureProfile(state, profile, now.toISOString());
      const locale = state.users[key].locale;
      const text = getLocale(locale);
      const active = state.activeActivities[key];
      if (active) {
        response = text.alreadyActive(
          profile.displayName,
          profile.userId,
          activityLabel(active.kind, locale),
        );
        return;
      }
      const dayKey = localDateKey(now, this.config.timeZone);
      const occurrence =
        state.records.filter(
          (record) =>
            record.chatId === profile.chatId &&
            record.userId === profile.userId &&
            record.kind === kind &&
            localDateKey(new Date(record.endedAt), this.config.timeZone) ===
              dayKey,
        ).length + 1;
      state.activeActivities[key] = {
        chatId: profile.chatId,
        userId: profile.userId,
        displayName: profile.displayName,
        kind,
        startedAt: now.toISOString(),
        limitMinutes:
          state.activityLimits?.[kind] || this.config.activityLimits[kind],
      };
      const limitMinutes =
        state.activityLimits?.[kind] || this.config.activityLimits[kind];
      response = text.started(
        profile.displayName,
        profile.userId,
        activityLabel(kind, locale),
        formatDateTime(now, this.config.timeZone),
        occurrence,
        limitMinutes,
      );
    });
    return response;
  }

  async settle(
    profile: Omit<UserProfile, "createdAt" | "updatedAt">,
    settledBy: "back" | "offwork" = "back",
  ) {
    const now = new Date();
    const key = userKey(profile.chatId, profile.userId);
    let response = "";
    await this.store.update((state) => {
      ensureProfile(state, profile, now.toISOString());
      const locale = state.users[key].locale;
      const text = getLocale(locale);
      const active = state.activeActivities[key];
      if (!active) {
        response =
          settledBy === "offwork"
            ? text.shiftEnded(formatDateTime(now, this.config.timeZone))
            : text.noActive;
        return;
      }

      const elapsedSeconds = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(active.startedAt).getTime()) / 1000,
        ),
      );
      state.records.push({
        id: createId(),
        chatId: active.chatId,
        userId: active.userId,
        displayName: active.displayName,
        kind: active.kind,
        startedAt: active.startedAt,
        endedAt: now.toISOString(),
        elapsedSeconds,
        settledBy,
      });
      delete state.activeActivities[key];

      const dayKey = localDateKey(now, this.config.timeZone);
      const matchingRecords = state.records.filter(
        (record) =>
          record.chatId === profile.chatId &&
          record.userId === profile.userId &&
          localDateKey(new Date(record.endedAt), this.config.timeZone) ===
            dayKey,
      );
      const activitySummary = matchingRecords
        .filter((record) => record.kind === active.kind)
        .reduce<ActivitySummary>(
          (summary, record) => ({
            count: summary.count + 1,
            seconds: summary.seconds + record.elapsedSeconds,
          }),
          { count: 0, seconds: 0 },
        );
      const totalSeconds = matchingRecords.reduce(
        (total, record) => total + record.elapsedSeconds,
        0,
      );
      const todayCounts = trackedActivities.reduce(
        (counts, kind) => {
          counts[kind] = matchingRecords.filter(
            (record) => record.kind === kind,
          ).length;
          return counts;
        },
        {
          eat: 0,
          wc: 0,
          smoke: 0,
          wcd: 0,
        } as Record<ActivityKind, number>,
      );
      response = text.settled(
        active.displayName,
        active.userId,
        activityLabel(active.kind, locale),
        formatDateTime(new Date(active.startedAt), this.config.timeZone),
        elapsedSeconds,
        active.limitMinutes,
        activitySummary.seconds,
        totalSeconds,
        todayCounts,
      );
    });
    return response;
  }

  async offWork(profile: Omit<UserProfile, "createdAt" | "updatedAt">) {
    return this.settle(profile, "offwork");
  }

  async getActivityLimits(): Promise<ActivityLimits> {
    const state = await this.store.load();
    return {
      ...this.config.activityLimits,
      ...state.activityLimits,
    };
  }

  async setActivityLimit(
    kind: ActivityKind,
    minutes: number,
  ): Promise<ActivityLimits> {
    let limits: ActivityLimits = { ...this.config.activityLimits };
    await this.store.update((state) => {
      limits = {
        ...this.config.activityLimits,
        ...state.activityLimits,
        [kind]: minutes,
      };
      state.activityLimits = limits;
    });
    return limits;
  }

  async dueActivityReminders(now = new Date()): Promise<ActiveActivity[]> {
    const state = await this.store.load();
    const nowMs = now.getTime();
    return Object.values(state.activeActivities)
      .filter((activity) => {
        const dueAt =
          new Date(activity.startedAt).getTime() +
          activity.limitMinutes * 60_000 +
          REMINDER_GRACE_MS;
        if (
          !Number.isFinite(dueAt) ||
          dueAt > nowMs ||
          activity.reminderSentAt
        ) {
          return false;
        }

        const claimedAt = activity.reminderClaimedAt
          ? new Date(activity.reminderClaimedAt).getTime()
          : Number.NaN;
        return (
          !Number.isFinite(claimedAt) ||
          nowMs - claimedAt >= REMINDER_CLAIM_LEASE_MS
        );
      })
      .map((activity) => ({ ...activity }));
  }

  async claimActivityReminder(
    candidate: Pick<ActiveActivity, "chatId" | "userId" | "startedAt">,
    now = new Date(),
  ): Promise<ActivityReminderClaim | undefined> {
    const key = userKey(candidate.chatId, candidate.userId);
    const claimedAt = now.toISOString();
    let claim: ActivityReminderClaim | undefined;

    await this.store.update((state) => {
      const activity = state.activeActivities[key];
      if (
        !activity ||
        activity.startedAt !== candidate.startedAt ||
        activity.reminderSentAt
      ) {
        return;
      }

      const dueAt =
        new Date(activity.startedAt).getTime() +
        activity.limitMinutes * 60_000 +
        REMINDER_GRACE_MS;
      if (!Number.isFinite(dueAt) || dueAt > now.getTime()) return;

      const existingClaim = activity.reminderClaimedAt
        ? new Date(activity.reminderClaimedAt).getTime()
        : Number.NaN;
      if (
        Number.isFinite(existingClaim) &&
        now.getTime() - existingClaim < REMINDER_CLAIM_LEASE_MS
      ) {
        return;
      }

      activity.reminderClaimedAt = claimedAt;
      claim = {
        activity: { ...activity },
        locale: state.users[key]?.locale || "zh",
        claimedAt,
      };
    });

    return claim;
  }

  async markActivityReminderSent(
    claim: ActivityReminderClaim,
    sentAt = new Date(),
  ): Promise<void> {
    const key = userKey(claim.activity.chatId, claim.activity.userId);
    await this.store.update((state) => {
      const activity = state.activeActivities[key];
      if (
        !activity ||
        activity.startedAt !== claim.activity.startedAt ||
        activity.reminderClaimedAt !== claim.claimedAt
      ) {
        return;
      }

      activity.reminderSentAt = sentAt.toISOString();
      delete activity.reminderClaimedAt;
    });
  }

  async releaseActivityReminderClaim(
    claim: ActivityReminderClaim,
  ): Promise<void> {
    const key = userKey(claim.activity.chatId, claim.activity.userId);
    await this.store.update((state) => {
      const activity = state.activeActivities[key];
      if (
        activity?.startedAt === claim.activity.startedAt &&
        activity.reminderClaimedAt === claim.claimedAt
      ) {
        delete activity.reminderClaimedAt;
      }
    });
  }

  async active(
    chatId: number,
    userId: number,
  ): Promise<ActiveActivity | undefined> {
    const state = await this.store.load();
    return state.activeActivities[userKey(chatId, userId)];
  }

  async snapshot(): Promise<BotState> {
    return this.store.load();
  }
}

export { formatDuration, formatDateTime, localDateKey, trackedActivities };
