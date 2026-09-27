import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BotState } from "../types";
import type { BotStore } from "./types";

const emptyState = (): BotState => ({
  users: {},
  activeActivities: {},
  records: [],
});

const isBotState = (value: unknown): value is BotState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BotState>;
  return (
    !!candidate.users &&
    typeof candidate.users === "object" &&
    !!candidate.activeActivities &&
    typeof candidate.activeActivities === "object" &&
    Array.isArray(candidate.records)
  );
};

export class FileBotStore implements BotStore {
  private state?: BotState;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<BotState> {
    if (this.state) return this.state;

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      this.state = isBotState(parsed) ? parsed : emptyState();
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code !== "ENOENT") throw error;
      this.state = emptyState();
    }

    return this.state;
  }

  async save(state: BotState): Promise<void> {
    this.state = state;
    const directory = path.dirname(this.filePath);
    const temporaryPath = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(temporaryPath, JSON.stringify(state, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    await this.writeQueue;
  }

  async update(mutator: (state: BotState) => void): Promise<BotState> {
    const state = await this.load();
    mutator(state);
    await this.save(state);
    return state;
  }
}