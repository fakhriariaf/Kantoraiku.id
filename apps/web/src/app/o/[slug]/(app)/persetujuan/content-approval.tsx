"use client";

import { useRouter } from "next/navigation";
import { ApprovalActions, type Decision } from "@/components/kantor/approval-actions";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { decideAction } from "./actions";

const DONE = { approve: "Naskah disetujui", revise: "Revisi dikirim ke agent", reject: "Naskah ditolak" } as const;

export function ContentApproval({ slug, approvalId, sticky }: { slug: string; approvalId: string; sticky?: boolean }) {
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
          toast({ title: DONE[d], tone: "success" });
        }
        router.refresh();
      }}
    />
  );
}
