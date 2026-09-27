export type BotRuntimeStatus = {
  enabled: boolean;
  running: boolean;
  lastUpdateAt?: string;
  lastError?: string;
};

let status: BotRuntimeStatus = {
  enabled: false,
  running: false,
};

export const setBotStatus = (next: Partial<BotRuntimeStatus>) => {
  status = { ...status, ...next };
};

export const getBotStatus = (): BotRuntimeStatus => ({ ...status });