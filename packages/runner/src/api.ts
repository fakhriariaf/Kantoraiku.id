import { PairResponse, WorkPackage, type CompleteRequest, type HeartbeatRequest, type PairRequest } from "@kantoraiku/shared";
import type { ConnectorConfig } from "./config.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call(server: string, path: string, body: unknown, token?: string): Promise<unknown> {
  const res = await fetch(new URL(path, server), {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 204) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new HttpError(res.status, data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function pairDevice(server: string, req: PairRequest) {
  return PairResponse.parse(await call(server, "/api/device/pair", req));
}

export function client(cfg: ConnectorConfig) {
  const post = (path: string, body: unknown) => call(cfg.server, path, body, cfg.deviceToken);
  return {
    heartbeat: async (h: HeartbeatRequest) => (await post("/api/device/heartbeat", h)) as { hasWork: boolean },
    claim: async () => {
      const r = await post("/api/device/runs/claim", {});
      return r ? WorkPackage.parse(r) : null;
    },
    progress: async (runId: string, p: { pct?: number; message?: string }) =>
      (await post(`/api/device/runs/${runId}/progress`, p)) as { cancel: boolean },
    complete: (runId: string, c: CompleteRequest) => post(`/api/device/runs/${runId}/complete`, c),
  };
}

export type Api = ReturnType<typeof client>;
