import type { WorkPackage } from "@kantoraiku/shared";

export type BrainResult = { output: unknown; inputTokens: number; outputTokens: number; costUsdMicros: number };
export type Progress = (pct: number, message: string) => Promise<void>;
export type Brain = (p: WorkPackage, progress: Progress) => Promise<BrainResult>;

export class BrainError extends Error {}
