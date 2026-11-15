import "server-only";
import { db, many, one } from "./db";
import {
  AgentInput,
  ChannelInput,
  TaskInput,
  addActivity,
  createAgent,
  createChannel,
  createTask,
  listAgents,
  listChannels,
  listDevices,
  listTasks,
  runTaskNow,
} from "./office";
import { SkillInput, agentSkillIds, createSkill, listSkills, setAgentSkills } from "./skills";
import { roomFor } from "@/lib/office-map";
import {
  MENU,
  type AssistantData,
  type AssistantMessage,
  type Brain,
  type Command,
  type ConvState,
  type Proposal,
  type ProposalState,
} from "@/lib/assistant";

// Asisten setup, iterasi 1: terpandu tanpa AI. Membaca keadaan kantor, mengusulkan langkah berikutnya
// sebagai kartu yang dikonfirmasi pemilik. Semua pembuatan lewat fungsi data layer yang sama dengan form.

const START: ConvState = { awaiting: null, draft: {}, skipped: [], flow: "setup" };
const NAMES = ["Dimas", "Dinda", "Fajar", "Nadia", "Aisyah", "Bayu", "Salsa", "Sekar", "Gilang", "Laila", "Yoga", "Citra"];
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

type Out = { body: string; data: AssistantData };

export async function listAssistantMessages(officeId: string) {
  return many<AssistantMessage>(
    await db(),
    `select id, role, body, data, created_at from (
       select id, role, body, data, created_at from public.assistant_messages
        where office_id = $1 and role in ('user','assistant') order by created_at desc, id desc limit 200
     ) m order by created_at, id`,
    [officeId],
  );
}

async function lastState(officeId: string): Promise<ConvState> {
  const r = await one<{ data: AssistantData }>(
    await db(),
    `select data from public.assistant_messages where office_id = $1 and role = 'assistant' order by created_at desc, id desc limit 1`,
    [officeId],
  );
  return { ...START, ...(r?.data.state ?? {}) };
}

async function insert(officeId: string, userId: string | null, role: "user" | "assistant", body: string, data: AssistantData = {}) {
  await (await db()).query(
    `insert into public.assistant_messages (office_id, user_id, role, body, data, created_at) values ($1, $2, $3, $4, $5, clock_timestamp())`,
    [officeId, userId, role, body, data],
  );
}

async function say(officeId: string, outs: Out[], state: ConvState) {
  for (const [i, o] of outs.entries()) {
    // Status percakapan dibawa pesan terakhir; balasan cepat hanya di pesan terakhir.
    await insert(officeId, null, "assistant", o.body, i === outs.length - 1 ? { ...o.data, state } : { ...o.data, replies: undefined });
  }
}

// ---------------------------------------------------------------------------
// Keadaan kantor dan langkah setup berikutnya
// ---------------------------------------------------------------------------

async function snapshot(officeId: string) {
  const [devices, channels, agents, skills, tasks] = await Promise.all([
    listDevices(officeId),
    listChannels(officeId),
    listAgents(officeId),
    listSkills(officeId),
    listTasks(officeId),
  ]);
  const live = devices.filter((d) => d.status !== "revoked");
  const brain: Brain = live.some((d) => d.ai_status?.claude === "ok") ? "claude" : live.some((d) => d.ai_status?.openai === "ok") ? "openai" : "simulation";
  const custom = agents.filter((a) => a.kind === "custom");
  return {
    devices: live,
    channel: channels[0] ?? null,
    custom,
    researcher: custom.find((a) => roomFor(a.title) === "riset") ?? null,
    writer: custom.find((a) => roomFor(a.title) === "naskah") ?? null,
    skills,
    tasks,
    brain,
  };
}
type Snap = Awaited<ReturnType<typeof snapshot>>;

function freeName(snap: Snap) {
  const used = new Set(snap.custom.map((a) => a.name.toLowerCase()));
  return NAMES.find((n) => !used.has(n.toLowerCase())) ?? `Agent ${snap.custom.length + 1}`;
}

const propose = (p: Proposal): ProposalState => ({ ...p, status: "pending" });

function agentProposal(snap: Snap, role: "riset" | "naskah"): Proposal {
  const ch = snap.channel;
  const about = ch ? `channel ${ch.name} (${cut(ch.niche || "topik umum", 200)})` : "channel kamu";
  return role === "riset"
    ? {
        tool: "create_agent",
        args: {
          name: freeName(snap),
          title: "Periset tren",
          brain: snap.brain,
          job_description: `Cari topik yang sedang ramai dan cocok untuk ${about}. Utamakan topik yang bisa dijelaskan dalam video pendek, sertakan sumber yang bisa dicek, dan hindari topik yang sudah pernah dibuat.`,
        },
      }
    : {
        tool: "create_agent",
        args: {
          name: freeName(snap),
          title: "Penulis naskah",
          brain: snap.brain,
          job_description: `Tulis naskah video pendek (30–60 detik) dari topik hasil riset untuk ${about}. Buka dengan kalimat yang membuat penonton bertahan, pakai bahasa sehari-hari, dan sertakan rencana visual per adegan.`,
        },
      };
}

function nextSetupStep(snap: Snap, state: ConvState): { outs: Out[]; state: ConvState } {
  const s = { ...state, flow: "setup" as const, awaiting: null };
  const skip = (k: string) => state.skipped.includes(k);
  const ch = snap.channel;

  if (snap.devices.length === 0 && !skip("pc")) {
    return {
      state: s,
      outs: [{
        body: "Pertama, sambungkan PC kamu. Agent bekerja di PC itu, jadi tanpa PC tugas hanya mengantre.\n\nBuka Pengaturan › PC dan perangkat, buat kode setup, lalu jalankan konektor di PC dengan kode itu.",
        data: { links: [{ label: "Buka Perangkat", href: "/perangkat" }], replies: [{ label: "Sudah, cek lagi", value: "lanjut" }, { label: "Lewati dulu", value: "lewati:pc" }] },
      }],
    };
  }
  if (!ch && !skip("channel")) {
    return {
      state: { ...s, awaiting: "channel_name", draft: {} },
      outs: [{
        body: "Sekarang channel kontennya: satu channel = satu akun media sosial dengan satu tema.\n\nApa nama channel kamu? Ketik di bawah, contoh: Resep 10 Menit.",
        data: { replies: [{ label: "Lewati dulu", value: "lewati:channel" }] },
      }],
    };
  }
  if (!snap.researcher && !skip("periset")) {
    return {
      state: { ...s, awaiting: "agent_name" },
      outs: [{
        body: "Berikutnya periset: dia mencari topik yang sedang ramai beserta sumbernya. Ini usulanku. Mau nama lain? Ketik saja namanya.",
        data: { proposal: propose(agentProposal(snap, "riset")) },
      }],
    };
  }
  if (!snap.writer && !skip("penulis")) {
    return {
      state: { ...s, awaiting: "agent_name" },
      outs: [{
        body: "Sekarang penulis naskah: dia mengubah hasil riset jadi naskah video yang kamu setujui dari HP. Mau nama lain? Ketik saja namanya.",
        data: { proposal: propose(agentProposal(snap, "naskah")) },
      }],
    };
  }
  if (snap.skills.length === 0 && snap.writer && !skip("skill")) {
    const name = ch ? cut(`Gaya ${ch.name}`, 80) : "Gaya channel";
    return {
      state: s,
      outs: [{
        body: `Skill adalah instruksi yang bisa dipakai beberapa agent sekaligus. Aku usulkan skill gaya channel untuk ${snap.writer.name}, supaya semua naskah terasa satu suara. Isinya bisa kamu ubah kapan saja di halaman Skill.`,
        data: {
          proposal: propose({
            tool: "create_skill",
            args: {
              name,
              description: "Nada, panjang, dan aturan naskah untuk channel ini.",
              body_md: [
                `# ${name}`,
                ch?.niche ? `Topik channel: ${cut(ch.niche, 300)}` : null,
                "- Kalimat pendek, bahasa sehari-hari, sapa penonton dengan \"kamu\".",
                "- Tiga detik pertama berisi janji atau pertanyaan yang membuat penasaran.",
                "- Satu ide per video, durasi 30–60 detik.",
                "- Tutup dengan ajakan ringan: simpan, ikuti, atau komentar.",
                "- Jangan melebih-lebihkan fakta; kalau ragu, sebut sumbernya.",
              ].filter(Boolean).join("\n"),
              agent_id: snap.writer.id,
              agent_name: snap.writer.name,
            },
          }),
        },
      }],
    };
  }
  const research = snap.tasks.find((t) => t.kind === "research");
  if (!research && ch && snap.researcher && snap.writer && !skip("tugas")) {
    return {
      state: s,
      outs: [{
        body: "Terakhir, tugas berantai: periset bekerja tiap pagi, lalu penulis otomatis menyambung begitu riset selesai. Jamnya bisa kamu ubah di halaman Tugas.",
        data: {
          proposal: propose({
            tool: "create_chain",
            args: {
              channel_id: ch.id,
              channel_name: ch.name,
              researcher_id: snap.researcher.id,
              researcher_name: snap.researcher.name,
              writer_id: snap.writer.id,
              writer_name: snap.writer.name,
              time: "08:00",
            },
          }),
        },
      }],
    };
  }
  if (snap.devices.length > 0 && snap.brain === "simulation" && snap.custom.some((a) => a.brain === "simulation") && !skip("kunci")) {
    return {
      state: s,
      outs: [{
        body: "Agent kamu masih memakai otak Simulasi: alurnya jalan, tapi isinya contoh. Supaya benar-benar memakai AI, isi API key OpenAI atau Anthropic di Pengaturan › Kunci & layanan (dienkripsi di browser untuk PC kamu), lalu ganti otak AI di form agent.",
        data: { links: [{ label: "Buka Kunci", href: "/kunci" }], replies: [{ label: "Mengerti", value: "lewati:kunci" }] },
      }],
    };
  }
  if (research && !skip("jalankan") && !snap.tasks.some((t) => t.last_status)) {
    return {
      state: s,
      outs: [{
        body: "Semua siap. Mau coba jalankan riset sekarang tanpa menunggu jadwal? Hasilnya muncul di Aktivitas, lalu naskahnya masuk ke Persetujuan.",
        data: { proposal: propose({ tool: "run_task", args: { task_id: research.id, task_name: research.name } }) },
      }],
    };
  }
  return {
    state: { ...s, flow: "single" },
    outs: [{
      body: "Setup dasar kantormu sudah lengkap. Kalau mau menambah sesuatu, pilih di bawah atau ketik misalnya \"buat agent\".",
      data: { replies: MENU.filter((m) => m.value !== "lanjut"), links: [{ label: "Lihat kantor", href: "" }] },
    }],
  };
}

// ---------------------------------------------------------------------------
// Pesan dari pemilik
// ---------------------------------------------------------------------------

const menu = (body = "Aku bisa membantu menyiapkan kantor. Pilih salah satu:"): Out => ({ body, data: { replies: MENU } });

async function startFlow(kind: "agent" | "skill" | "channel", state: ConvState): Promise<{ outs: Out[]; state: ConvState }> {
  const s: ConvState = { ...state, flow: "single", draft: {} };
  if (kind === "agent") return { state: { ...s, awaiting: "agent_title" }, outs: [{ body: "Agent baru dengan jabatan apa? Contoh: Periset kompetitor, Penulis caption, Editor video.", data: {} }] };
  if (kind === "skill") return { state: { ...s, awaiting: "skill_name" }, outs: [{ body: "Apa nama skill-nya? Contoh: Gaya bahasa santai.", data: {} }] };
  return { state: { ...s, awaiting: "channel_name" }, outs: [{ body: "Apa nama channel barunya?", data: {} }] };
}

async function pendingProposal(officeId: string, tool: Proposal["tool"]) {
  return one<{ id: string; data: AssistantData }>(
    await db(),
    `select id, data from public.assistant_messages
      where office_id = $1 and role = 'assistant' and data->'proposal'->>'status' = 'pending' and data->'proposal'->>'tool' = $2
      order by created_at desc limit 1`,
    [officeId, tool],
  );
}

async function setProposal(officeId: string, id: string, patch: Partial<ProposalState>) {
  await (await db()).query(
    `update public.assistant_messages set data = jsonb_set(data, '{proposal}', (data->'proposal') || $3::jsonb) where office_id = $1 and id = $2`,
    [officeId, id, patch],
  );
}

async function onText(officeId: string, text: string, state: ConvState): Promise<{ outs: Out[]; state: ConvState }> {
  const t = text.toLowerCase();
  switch (state.awaiting) {
    case "channel_name":
      if (text.length > 80) return { state, outs: [{ body: "Nama channel maksimal 80 karakter. Coba yang lebih pendek.", data: {} }] };
      return { state: { ...state, awaiting: "channel_niche", draft: { channel_name: text } }, outs: [{ body: `Oke, ${text}. Topiknya tentang apa? Tulis satu atau dua kalimat, misalnya untuk siapa dan gayanya seperti apa.`, data: {} }] };
    case "channel_niche":
      if (text.length > 2000) return { state, outs: [{ body: "Topiknya terlalu panjang (maks 2.000 karakter).", data: {} }] };
      return {
        state: { ...state, awaiting: null },
        outs: [{ body: "Ini channel yang akan kubuat. Mode awalnya Manual: setiap konten menunggu persetujuanmu.", data: { proposal: propose({ tool: "create_channel", args: { name: state.draft.channel_name || text, niche: text } }) } }],
      };
    case "agent_title": {
      if (text.length > 60) return { state, outs: [{ body: "Jabatan maksimal 60 karakter.", data: {} }] };
      const snap = await snapshot(officeId);
      return {
        state: { ...state, awaiting: "agent_name" },
        outs: [{
          body: "Ini usulanku. Mau nama lain? Ketik saja namanya.",
          data: { proposal: propose({ tool: "create_agent", args: { name: freeName(snap), title: text, brain: snap.brain, job_description: `Kerjakan tugas sebagai ${text}. Tulis hasil yang rapi, jelas, dan sesuai tema channel.` } }) },
        }],
      };
    }
    case "agent_name": {
      const prev = await pendingProposal(officeId, "create_agent");
      if (prev?.data.proposal?.tool === "create_agent") {
        if (text.length > 40) return { state, outs: [{ body: "Nama agent maksimal 40 karakter.", data: {} }] };
        await setProposal(officeId, prev.id, { status: "replaced" });
        return {
          state,
          outs: [{ body: `Oke, namanya ${text}.`, data: { proposal: propose({ tool: "create_agent", args: { ...prev.data.proposal.args, name: text } }) } }],
        };
      }
      break;
    }
    case "skill_name":
      if (text.length > 80) return { state, outs: [{ body: "Nama skill maksimal 80 karakter.", data: {} }] };
      return { state: { ...state, awaiting: "skill_body", draft: { skill_name: text } }, outs: [{ body: "Tulis instruksinya, seperti memberi arahan ke karyawan baru.", data: {} }] };
    case "skill_body":
      return {
        state: { ...state, awaiting: null },
        outs: [{ body: "Ini skill yang akan kubuat. Setelah itu kamu bisa memasangnya ke agent di form agent.", data: { proposal: propose({ tool: "create_skill", args: { name: state.draft.skill_name || "Skill baru", description: "", body_md: text, agent_id: null, agent_name: null } }) } }],
      };
  }

  if (/^(menu|bantuan|help|\?)$|bisa apa/.test(t)) return { state: { ...state, awaiting: null }, outs: [menu()] };
  if (/channel/.test(t)) return startFlow("channel", state);
  if (/skill/.test(t)) return startFlow("skill", state);
  if (/agent|karyawan/.test(t)) return startFlow("agent", state);
  if (/tugas|jadwal/.test(t)) return { state, outs: [{ body: "Tugas dan jadwalnya diatur di halaman Tugas: pilih agent, channel, dan kapan tugas berjalan (jam tertentu atau setelah tugas lain).", data: { links: [{ label: "Buka Tugas", href: "/tugas" }], replies: MENU } }] };
  if (/\bpc\b|perangkat|konektor|kode setup/.test(t)) return { state, outs: [{ body: "PC disambungkan dari Pengaturan › PC dan perangkat: buat kode setup, lalu jalankan konektor di PC dengan kode itu.", data: { links: [{ label: "Buka Perangkat", href: "/perangkat" }], replies: MENU } }] };
  if (/kunci|api key|claude|openai|elevenlabs/.test(t)) return { state, outs: [{ body: "Kunci API diisi di Pengaturan › Kunci & layanan. Kuncinya dienkripsi di browser untuk PC kamu, jadi server tidak bisa membacanya.", data: { links: [{ label: "Buka Kunci", href: "/kunci" }], replies: MENU } }] };
  if (/halo|hai|hi\b|mulai|setup|lanjut|siap|^ok|oke/.test(t)) return nextSetupStep(await snapshot(officeId), state);
  return { state, outs: [menu("Maaf, aku versi awal dan belum bisa memahami kalimat bebas. Pilih salah satu di bawah, atau ketik \"menu\".")] };
}

export async function sendText(officeId: string, userId: string, text: string) {
  const state = await lastState(officeId);
  await insert(officeId, userId, "user", text);
  const r = await onText(officeId, text, state);
  await say(officeId, r.outs, r.state);
}

const COMMAND_LABEL: Record<Command, string> = {
  mulai: "Mulai setup",
  lanjut: "Lanjut setup",
  menu: "Menu",
  "buat:agent": "Buat agent",
  "buat:skill": "Buat skill",
  "buat:channel": "Buat channel",
  "lewati:pc": "Lewati dulu",
  "lewati:channel": "Lewati dulu",
  "lewati:kunci": "Mengerti",
};

export async function sendCommand(officeId: string, userId: string, cmd: Command, label?: string) {
  const state = { ...(await lastState(officeId)), awaiting: null };
  await insert(officeId, userId, "user", label && label.length <= 40 ? label : COMMAND_LABEL[cmd]);
  let r: { outs: Out[]; state: ConvState };
  if (cmd === "menu") r = { state, outs: [menu()] };
  else if (cmd.startsWith("buat:")) r = await startFlow(cmd.slice(5) as "agent" | "skill" | "channel", state);
  else {
    const skipped = cmd.startsWith("lewati:") ? [...new Set([...state.skipped, cmd.slice(7)])] : state.skipped;
    r = nextSetupStep(await snapshot(officeId), { ...state, skipped });
  }
  await say(officeId, r.outs, r.state);
}

// ---------------------------------------------------------------------------
// Kartu usulan: jalankan atau lewati
// ---------------------------------------------------------------------------

/** Ambil usulan yang masih menunggu secara atomik (klik ganda tidak menjalankan dua kali). */
async function claim(officeId: string, messageId: string, to: "running" | "skipped") {
  const r = await one<{ data: AssistantData }>(
    await db(),
    `update public.assistant_messages set data = jsonb_set(data, '{proposal,status}', to_jsonb($3::text))
      where office_id = $1 and id = $2 and role = 'assistant' and data->'proposal'->>'status' = 'pending'
      returning data`,
    [officeId, messageId, to],
  );
  return r?.data.proposal ?? null;
}

type Result = { ok: true; text: string; href: string } | { ok: false; text: string };

async function execute(officeId: string, p: Proposal): Promise<Result> {
  const d = await db();
  switch (p.tool) {
    case "create_channel": {
      const v = ChannelInput.safeParse({ name: p.args.name, niche: p.args.niche, content_language: "id", mode: "manual", post_times: [] });
      if (!v.success) return { ok: false, text: v.error.issues[0].message };
      const id = await createChannel(officeId, v.data);
      await addActivity(d, officeId, "assistant.tool", `Asisten membuat channel ${v.data.name}`);
      return { ok: true, text: `Channel ${v.data.name} sudah dibuat.`, href: `/channel/${id}` };
    }
    case "create_agent": {
      const v = AgentInput.safeParse({ ...p.args, model: "", appearance: "" });
      if (!v.success) return { ok: false, text: v.error.issues[0].message };
      const r = await createAgent(officeId, v.data);
      if ("error" in r && r.error) return { ok: false, text: r.error };
      await addActivity(d, officeId, "assistant.tool", `Asisten membuat agent ${v.data.name} (${v.data.title})`);
      return { ok: true, text: `${v.data.name} sudah bergabung sebagai ${v.data.title}.`, href: `/agent/${(r as { id: string }).id}` };
    }
    case "create_skill": {
      const v = SkillInput.safeParse(p.args);
      if (!v.success) return { ok: false, text: v.error.issues[0].message };
      const r = await createSkill(officeId, v.data);
      if ("error" in r) return { ok: false, text: r.error };
      if (p.args.agent_id) await setAgentSkills(officeId, p.args.agent_id, [...(await agentSkillIds(officeId, p.args.agent_id)), r.id]);
      await addActivity(d, officeId, "assistant.tool", `Asisten membuat skill ${v.data.name}`);
      return { ok: true, text: `Skill ${v.data.name} sudah dibuat${p.args.agent_name ? ` dan dipasang ke ${p.args.agent_name}` : ""}.`, href: `/skill/${r.id}` };
    }
    case "create_chain": {
      const a = p.args;
      const research = TaskInput.safeParse({
        name: cut(`Riset ${a.channel_name}`, 80), agent_id: a.researcher_id, channel_id: a.channel_id, kind: "research",
        instructions: "Cari 3 topik untuk video berikutnya, lengkap dengan sumbernya.", trigger: "schedule", time: a.time, days: [1, 2, 3, 4, 5, 6, 7],
      });
      if (!research.success) return { ok: false, text: research.error.issues[0].message };
      const r1 = await createTask(officeId, research.data);
      if ("error" in r1) return { ok: false, text: r1.error! };
      const script = TaskInput.safeParse({
        name: cut(`Naskah ${a.channel_name}`, 80), agent_id: a.writer_id, channel_id: a.channel_id, kind: "script",
        instructions: "Pilih topik terbaik dari hasil riset, lalu tulis naskahnya.", trigger: "after_task", after_task_id: r1.id,
      });
      if (!script.success) return { ok: false, text: script.error.issues[0].message };
      const r2 = await createTask(officeId, script.data);
      if ("error" in r2) return { ok: false, text: r2.error! };
      await addActivity(d, officeId, "assistant.tool", `Asisten membuat tugas berantai untuk ${a.channel_name}`);
      return { ok: true, text: `Tugas berantai dibuat: ${a.researcher_name} meriset tiap hari jam ${a.time}, lalu ${a.writer_name} menulis naskah.`, href: "/tugas" };
    }
    case "run_task": {
      const id = await runTaskNow(officeId, p.args.task_id);
      if (!id) return { ok: false, text: "Tugas itu tidak ditemukan." };
      return { ok: true, text: `${p.args.task_name} masuk antrean. Konektor di PC akan mengambilnya begitu menyala.`, href: "/tugas" };
    }
  }
}

const SKIP_KEY: Record<Proposal["tool"], (p: Proposal) => string | null> = {
  create_channel: () => "channel",
  create_agent: (p) => (p.tool === "create_agent" ? ({ riset: "periset", naskah: "penulis" } as Record<string, string>)[roomFor(p.args.title)] ?? null : null),
  create_skill: () => "skill",
  create_chain: () => "tugas",
  run_task: () => "jalankan",
};

export async function confirmProposal(officeId: string, userId: string, messageId: string) {
  const p = await claim(officeId, messageId, "running");
  if (!p) return;
  const state = await lastState(officeId);
  await insert(officeId, userId, "user", describeConfirm(p));
  let res: Result;
  try {
    res = await execute(officeId, p);
  } catch (e) {
    await setProposal(officeId, messageId, { status: "pending" });
    throw e;
  }
  if (!res.ok) {
    await setProposal(officeId, messageId, { status: "pending" });
    const rename = p.tool === "create_agent";
    await say(officeId, [{ body: `Belum berhasil: ${res.text}${rename ? " Ketik nama lain untuk agent ini." : ""}`, data: {} }], { ...state, awaiting: rename ? "agent_name" : state.awaiting });
    return;
  }
  await setProposal(officeId, messageId, { status: "done", result: res.text, href: res.href });
  const next = state.flow === "setup" ? nextSetupStep(await snapshot(officeId), { ...state, awaiting: null }) : { state: { ...state, awaiting: null }, outs: [menu("Ada lagi yang mau dibuat?")] };
  await say(officeId, [{ body: res.text, data: { links: [{ label: "Lihat", href: res.href }] } }, ...next.outs], next.state);
}

function describeConfirm(p: Proposal) {
  return { create_channel: "Buat channel", create_agent: "Buat agent", create_skill: "Buat skill", create_chain: "Buat tugas", run_task: "Jalankan" }[p.tool];
}

export async function skipProposal(officeId: string, userId: string, messageId: string) {
  const p = await claim(officeId, messageId, "skipped");
  if (!p) return;
  const state = await lastState(officeId);
  await insert(officeId, userId, "user", "Lewati");
  const key = SKIP_KEY[p.tool](p);
  const skipped = key ? [...new Set([...state.skipped, key])] : state.skipped;
  const next =
    state.flow === "setup"
      ? nextSetupStep(await snapshot(officeId), { ...state, skipped, awaiting: null })
      : { state: { ...state, skipped, awaiting: null }, outs: [menu("Oke, tidak jadi. Ada yang lain?")] };
  await say(officeId, [{ body: "Oke, dilewati. Kamu bisa membuatnya nanti sendiri.", data: {} }, ...next.outs], next.state);
}
