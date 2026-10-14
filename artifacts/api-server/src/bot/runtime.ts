import type { AttendanceService } from "./attendance-service";

export type BotRuntimeStatus = {
  enabled: boolean;
  running: boolean;
  lastUpdateAt?: string;
  lastError?: string;
};

let status: BotRuntimeStatus = { enabled: false, running: false };
let attendanceService: AttendanceService | undefined;

export const setBotStatus = (next: Partial<BotRuntimeStatus>) => {
  status = { ...status, ...next };
};

export const getBotStatus = (): BotRuntimeStatus => ({ ...status });

export const setAttendanceService = (service: AttendanceService | undefined) => {
  attendanceService = service;
};

export const getAttendanceService = () => attendanceService;
