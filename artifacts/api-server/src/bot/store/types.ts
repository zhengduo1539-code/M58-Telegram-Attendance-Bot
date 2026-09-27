import type { BotState } from "../types";

export interface BotStore {
  load(): Promise<BotState>;
  save(state: BotState): Promise<void>;
  update(mutator: (state: BotState) => void): Promise<BotState>;
}