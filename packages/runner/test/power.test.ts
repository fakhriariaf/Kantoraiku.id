import { test } from "node:test";
import assert from "node:assert/strict";
import { onBattery } from "../src/power.ts";

test("baterai: bisa dipaksa lewat env (uji) dan tidak pernah melempar error", async () => {
  process.env.KANTORAIKU_ON_BATTERY = "1";
  assert.equal(await onBattery(), true);
  process.env.KANTORAIKU_ON_BATTERY = "0";
  assert.equal(await onBattery(), false);
  delete process.env.KANTORAIKU_ON_BATTERY;
  assert.equal(typeof (await onBattery()), "boolean");
});
