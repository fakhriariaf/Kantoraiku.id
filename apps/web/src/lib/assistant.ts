// Tipe percakapan asisten setup (S28), dipakai server dan layar chat.
// Iterasi 1: asisten terpandu tanpa AI. Usulan alat (Proposal) sama bentuknya dengan alat yang nanti
// dipanggil otak AI di PC, jadi layar dan eksekusinya tidak berubah saat otaknya diganti.

export type Brain = "simulation" | "openai" | "claude";

export type Reply = { label: string; value: string };
/** href relatif ke /o/{slug}, mis. "/perangkat". */
export type Link = { label: string; href: string };

export type Proposal =
  | { tool: "create_channel"; args: { name: string; niche: string } }
  | { tool: "create_agent"; args: { name: string; title: string; job_description: string; brain: Brain } }
  | { tool: "create_skill"; args: { name: string; description: string; body_md: string; agent_id: string | null; agent_name: string | null } }
  | {
      tool: "create_chain";
      args: {
        channel_id: string;
        channel_name: string;
        researcher_id: string;
        researcher_name: string;
        writer_id: string;
        writer_name: string;
        time: string;
      };
    }
  | { tool: "run_task"; args: { task_id: string; task_name: string } };

export type ProposalStatus = "pending" | "running" | "done" | "skipped" | "replaced";
export type ProposalState = Proposal & { status: ProposalStatus; result?: string; href?: string };

export type Awaiting = "channel_name" | "channel_niche" | "agent_title" | "agent_name" | "skill_name" | "skill_body" | null;
export type ConvState = { awaiting: Awaiting; draft: Record<string, string>; skipped: string[]; flow: "setup" | "single" };

export type AssistantData = { replies?: Reply[]; links?: Link[]; proposal?: ProposalState; state?: ConvState };
export type AssistantMessage = { id: string; role: "user" | "assistant"; body: string; data: AssistantData; created_at: string };

const BRAIN_LABEL: Record<Brain, string> = { simulation: "Simulasi", openai: "OpenAI", claude: "Claude" };

/** Judul, isian, dan label tombol kartu usulan. */
export function describeProposal(p: Proposal): { title: string; rows: [string, string][]; confirm: string } {
  switch (p.tool) {
    case "create_channel":
      return { title: "Buat channel", rows: [["Nama", p.args.name], ["Topik", p.args.niche], ["Mode", "Manual (kamu setujui tiap konten)"]], confirm: "Buat channel" };
    case "create_agent":
      return {
        title: "Buat agent",
        rows: [["Nama", p.args.name], ["Jabatan", p.args.title], ["Otak AI", BRAIN_LABEL[p.args.brain]], ["Job desk", p.args.job_description]],
        confirm: "Buat agent",
      };
    case "create_skill":
      return {
        title: "Buat skill",
        rows: [["Nama", p.args.name], ...(p.args.agent_name ? ([["Dipasang ke", p.args.agent_name]] as [string, string][]) : []), ["Instruksi", p.args.body_md]],
        confirm: "Buat skill",
      };
    case "create_chain":
      return {
        title: "Buat tugas berantai",
        rows: [
          ["Langkah 1", `${p.args.researcher_name} meriset topik untuk ${p.args.channel_name}, tiap hari jam ${p.args.time}`],
          ["Langkah 2", `Setelah riset selesai, ${p.args.writer_name} menulis naskah lalu menunggu persetujuanmu`],
        ],
        confirm: "Buat tugas",
      };
    case "run_task":
      return { title: "Jalankan sekarang", rows: [["Tugas", p.args.task_name]], confirm: "Jalankan" };
  }
}

export const MENU: Reply[] = [
  { label: "Lanjut setup", value: "lanjut" },
  { label: "Buat agent", value: "buat:agent" },
  { label: "Buat skill", value: "buat:skill" },
  { label: "Buat channel", value: "buat:channel" },
];

export const COMMANDS = ["mulai", "lanjut", "menu", "buat:agent", "buat:skill", "buat:channel", "lewati:pc", "lewati:channel", "lewati:kunci"] as const;
export type Command = (typeof COMMANDS)[number];
