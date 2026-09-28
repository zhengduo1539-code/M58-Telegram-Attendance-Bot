import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BotState } from "../types";
import type { BotStore } from "./types";

const emptyState = (): BotState => ({
  users: {},
  activeActivities: {},
  records: [],
  activityLimits: {},
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBotState = (value: unknown): value is BotState => {
  if (!isObjectRecord(value)) return false;
  const candidate = value as Partial<BotState>;
  return (
    isObjectRecord(candidate.users) &&
    Object.values(candidate.users).every(isObjectRecord) &&
    isObjectRecord(candidate.activeActivities) &&
    Object.values(candidate.activeActivities).every(isObjectRecord) &&
    Array.isArray(candidate.records) &&
    candidate.records.every(isObjectRecord) &&
    (candidate.activityLimits === undefined ||
      isObjectRecord(candidate.activityLimits))
  );
};

export class FileBotStore implements BotStore {
  private state?: BotState;
  private writeQueue: Promise<void> = Promise.resolve();
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<BotState> {
    if (this.state) return this.state;

    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "ENOENT") {
        this.state = emptyState();
        return this.state;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await this.quarantineCorruptState();
      this.state = emptyState();
      return this.state;
    }

    if (!isBotState(parsed)) {
      await this.quarantineCorruptState();
      this.state = emptyState();
      return this.state;
    }

    this.state = parsed;
    return this.state;
  }

  async save(state: BotState): Promise<void> {
    this.state = state;
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.tmp`;
    const write = this.writeQueue.then(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    this.writeQueue = write.catch(() => undefined);
    await write;
  }

  async update(mutator: (state: BotState) => void): Promise<BotState> {
    let updatedState: BotState | undefined;
    const update = this.updateQueue.then(async () => {
      const state = await this.load();
      mutator(state);
      await this.save(state);
      updatedState = state;
    });
    this.updateQueue = update.catch(() => undefined);
    await update;
    return updatedState as BotState;
  }

  private async quarantineCorruptState(): Promise<void> {
    const quarantinePath = `${this.filePath}.corrupt-${Date.now()}.json`;
    try {
      await rename(this.filePath, quarantinePath);
    } catch {
      // If the file disappears between read and rename, the next write can
      // still recreate a valid state file.
    }
  }
}
