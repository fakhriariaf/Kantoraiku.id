"use client";

import { useState } from "react";
import { PipelineSteps, type Step } from "@/components/kantor/pipeline-steps";
import { SegmentedControl } from "@/components/ui/segmented";

type Mode = "manual" | "auto";

const later: Step[] = [
  { key: "video", label: "Video", state: "pending", detail: "segera hadir" },
  { key: "publish", label: "Terbit", state: "pending", detail: "segera hadir" },
];

function steps(mode: Mode): Step[] {
  return [
    { key: "research", label: "Riset", state: "done", detail: "3 topik + sumber" },
    { key: "script", label: "Naskah", state: "done", detail: "140 kata · 55 detik" },
    mode === "manual"
      ? { key: "approval", label: "Persetujuan", state: "waiting", detail: "menunggu kamu" }
      : { key: "approval", label: "Persetujuan", state: "done", detail: "otomatis" },
    ...later,
  ];
}

const explain: Record<Mode, string> = {
  manual: "Setiap naskah berhenti di persetujuan. Kamu baca dari HP, lalu setujui, minta revisi dengan catatan, atau tolak.",
  auto: "Naskah langsung dianggap disetujui. Cocok untuk channel yang sudah kamu percayakan ke agent.",
};

/** Contoh alur satu konten di landing (S01). Mode bisa diganti per channel di dashboard. */
export function FlowDemo() {
  const [mode, setMode] = useState<Mode>("manual");
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-5 shadow-card md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-text">Channel: Resep 10 menit</p>
        <SegmentedControl
          label="Mode channel"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "manual", label: "Manual" },
            { value: "auto", label: "Otomatis" },
          ]}
        />
      </div>
      <PipelineSteps steps={steps(mode)} label="Contoh tahap satu konten" />
      <p aria-live="polite" className="border-t border-border pt-4 text-sm text-text-2">
        {explain[mode]}
      </p>
    </div>
  );
}
