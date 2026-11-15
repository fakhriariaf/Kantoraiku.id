"use client";

import { useRouter } from "next/navigation";
import { ApprovalActions, type Decision } from "@/components/kantor/approval-actions";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { decideAction } from "./actions";

const DONE = {
  script: { approve: "Naskah disetujui", revise: "Revisi dikirim ke agent", reject: "Naskah ditolak" },
  video: { approve: "Video disetujui", revise: "Video dibuat ulang", reject: "Video ditolak" },
} as const;

export function ContentApproval({
  slug,
  approvalId,
  sticky,
  stage = "script",
}: {
  slug: string;
  approvalId: string;
  sticky?: boolean;
  stage?: "script" | "video";
}) {
  const toast = useToast();
  const router = useRouter();
  const call = useServerCall();
  return (
    <ApprovalActions
      sticky={sticky}
      onDecide={async (d: Decision, note?: string) => {
        const r = await call(() => decideAction(slug, approvalId, d, note));
        if (!r) return;
        if ("error" in r && r.error) {
          toast({ title: r.error, tone: "error" });
        } else {
          toast({ title: DONE[stage][d], tone: "success" });
        }
        router.refresh();
      }}
    />
  );
}
