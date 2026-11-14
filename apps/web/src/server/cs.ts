import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import "./zod-id";
import { db, many, one, type Sql } from "./db";
import { addActivity } from "./office";

// CS WhatsApp (S25-S27). Pesan masuk lewat webhook Cloud API resmi (atau simulasi di dashboard),
// agent CS di PC/VPS menyusun balasan dari info bisnis, server mengirimnya lewat Cloud API.
// Semua fungsi menerima officeId yang sudah dicek lewat requireMember().

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Jendela layanan pelanggan WhatsApp: pesan bebas hanya boleh dalam 24 jam sejak pesan pelanggan terakhir. */
const WINDOW_HOURS = 24;

// ---------------------------------------------------------------------------
// Info bisnis (S27)
// ---------------------------------------------------------------------------

export const BusinessInfoInput = z
  .array(
    z.object({
      title: z.string().trim().min(1, "Isi judul bagian.").max(120, "Judul maksimal 120 karakter."),
      body: z.string().trim().max(20000, "Isi bagian terlalu panjang (maks 20.000 karakter)."),
    }),
  )
  .max(30, "Maksimal 30 bagian.");

export async function listBusinessInfo(officeId: string) {
  return many<{ id: string; title: string; body: string }>(
    await db(),
    `select id, title, body from public.business_infos where office_id = $1 order by position, created_at`,
    [officeId],
  );
}

/** Ganti seluruh info bisnis (urutan = urutan di form). */
export async function saveBusinessInfo(officeId: string, items: z.infer<typeof BusinessInfoInput>) {
  await (await db()).transaction(async (tx) => {
    await tx.query(`delete from public.business_infos where office_id = $1`, [officeId]);
    for (const [i, it] of items.entries()) {
      await tx.query(`insert into public.business_infos (office_id, title, body, position) values ($1, $2, $3, $4)`, [officeId, it.title, it.body, i]);
    }
  });
}

export async function businessInfoText(sql: Sql, officeId: string) {
  const rows = await many<{ title: string; body: string }>(
    sql,
    `select title, body from public.business_infos where office_id = $1 order by position, created_at`,
    [officeId],
  );
  return rows.map((r) => `## ${r.title}\n${r.body}`).join("\n\n");
}

// ---------------------------------------------------------------------------
// Koneksi dan agent CS
// ---------------------------------------------------------------------------

export type Connection = {
  id: string;
  mode: "cloud" | "simulation";
  display_phone: string;
  status: "pending" | "active" | "disconnected";
  agent_id: string | null;
  agent_name: string | null;
};

export async function listConnections(officeId: string) {
  return many<Connection>(
    await db(),
    `select w.id, w.mode, w.display_phone, w.status, w.agent_id, a.name as agent_name
       from public.wa_connections w left join public.agents a on a.id = w.agent_id
      where w.office_id = $1 order by w.mode, w.created_at`,
    [officeId],
  );
}

/** Pasang agent CS di koneksi + pastikan ada tugas "Balas WhatsApp" untuknya. Null = matikan balasan otomatis. */
export async function setCsAgent(officeId: string, connectionId: string, agentId: string | null) {
  if (!UUID.test(connectionId) || (agentId && !UUID.test(agentId))) return { error: "Data tidak valid." };
  return (await db()).transaction(async (tx) => {
    if (agentId) {
      const a = await one<{ id: string }>(tx, `select id from public.agents where office_id = $1 and id = $2 and archived_at is null`, [officeId, agentId]);
      if (!a) return { error: "Agent tidak ditemukan." };
      await tx.query(
        `insert into public.tasks (office_id, agent_id, name, kind, trigger, priority, instructions)
         values ($1, $2, 'Balas WhatsApp', 'cs_reply', 'event', 2, '')
         on conflict (agent_id) where kind = 'cs_reply' do update set enabled = true`,
        [officeId, agentId],
      );
    }
    const r = await one<{ id: string }>(tx, `update public.wa_connections set agent_id = $3 where office_id = $1 and id = $2 returning id`, [officeId, connectionId, agentId]);
    return r ? { ok: true as const } : { error: "Koneksi tidak ditemukan." };
  });
}

/** Koneksi simulasi kantor ini (dibuat bila belum ada). */
export async function simulationConnection(officeId: string) {
  const d = await db();
  await d.query(
    `insert into public.wa_connections (office_id, mode, waba_id, phone_number_id, display_phone, status)
     values ($1, 'simulation', 'simulasi', $2, 'Simulasi', 'active')
     on conflict (office_id) where mode = 'simulation' do nothing`,
    [officeId, `sim-${officeId}`],
  );
  return (await one<{ id: string }>(d, `select id from public.wa_connections where office_id = $1 and mode = 'simulation'`, [officeId]))!.id;
}

// ---------------------------------------------------------------------------
// Pesan masuk
// ---------------------------------------------------------------------------

type Inbound = {
  connectionId: string;
  officeId: string;
  customerWaId: string;
  customerName: string | null;
  waMessageId: string;
  body: string | null;
  mediaType: string | null;
};

/** Simpan pesan pelanggan (idempoten per wa_message_id) dan antrekan balasan agent bila percakapan dipegang agent. */
export async function receiveInbound(m: Inbound) {
  return (await db()).transaction(async (tx) => {
    const conv = await one<{ id: string; handled_by: "agent" | "human" }>(
      tx,
      `insert into public.cs_conversations (office_id, wa_connection_id, customer_wa_id, customer_name, last_message_at, last_customer_message_at, unread_count)
       values ($1, $2, $3, $4, now(), now(), 0)
       on conflict (wa_connection_id, customer_wa_id) do update set customer_name = coalesce(excluded.customer_name, public.cs_conversations.customer_name)
       returning id, handled_by`,
      [m.officeId, m.connectionId, m.customerWaId, m.customerName],
    );
    const msg = await one<{ id: string }>(
      tx,
      `insert into public.cs_messages (office_id, conversation_id, direction, wa_message_id, body, media, status, sent_by)
       values ($1, $2, 'in', $3, $4, $5, 'received', 'customer')
       on conflict (wa_message_id) do nothing returning id`,
      [m.officeId, conv!.id, m.waMessageId, m.body, m.mediaType ? { type: m.mediaType } : null],
    );
    if (!msg) return { duplicate: true as const, conversationId: conv!.id };
    await tx.query(
      `update public.cs_conversations set last_message_at = now(), last_customer_message_at = now(), unread_count = unread_count + 1 where id = $1`,
      [conv!.id],
    );
    if (conv!.handled_by === "agent") await queueReply(tx, m.officeId, m.connectionId, conv!.id);
    return { duplicate: false as const, conversationId: conv!.id, messageId: msg.id };
  });
}

/** Satu run balasan per percakapan pada satu waktu: pesan beruntun dijawab sekaligus. */
async function queueReply(tx: Sql, officeId: string, connectionId: string, conversationId: string) {
  await tx.query(
    `insert into public.task_runs (office_id, task_id, agent_id, trigger_source, priority, required_capability, input)
     select t.office_id, t.id, t.agent_id, 'event', t.priority, t.required_capability, jsonb_build_object('conversation_id', $3::uuid)
       from public.wa_connections w
       join public.tasks t on t.agent_id = w.agent_id and t.kind = 'cs_reply' and t.enabled
       join public.agents a on a.id = t.agent_id and a.archived_at is null
      where w.id = $2 and w.office_id = $1 and w.status = 'active'
        and not exists (select 1 from public.task_runs r where r.office_id = $1 and r.input->>'conversation_id' = $3::text
                         and r.status in ('queued', 'claimed', 'running'))`,
    [officeId, connectionId, conversationId],
  );
}

/** Paket kerja untuk run cs_reply: 20 pesan terakhir + info bisnis. */
export async function csContext(tx: Sql, officeId: string, conversationId: string) {
  const conv = await one<{ id: string; customer_name: string | null }>(
    tx,
    `select id, customer_name from public.cs_conversations where office_id = $1 and id = $2`,
    [officeId, conversationId],
  );
  if (!conv) return null;
  const rows = await many<{ sent_by: "customer" | "agent" | "human"; body: string | null; media: { type: string } | null }>(
    tx,
    `select sent_by, body, media from (select * from public.cs_messages where conversation_id = $1 and (direction = 'in' or status <> 'failed')
       order by created_at desc limit 20) x order by created_at`,
    [conversationId],
  );
  return {
    conversationId: conv.id,
    customerName: conv.customer_name,
    businessInfo: await businessInfoText(tx, officeId),
    messages: rows.map((r) => ({ from: r.sent_by, text: r.body ?? `[pelanggan mengirim ${r.media?.type ?? "lampiran"}]` })),
  };
}

/** Catat balasan agent (status queued). Pengiriman dilakukan setelah transaksi selesai (deliver). */
export async function recordAgentReply(tx: Sql, officeId: string, conversationId: string, runId: string, reply: string, handoff: boolean, agentId: string) {
  const m = await one<{ id: string }>(
    tx,
    `insert into public.cs_messages (office_id, conversation_id, direction, body, status, sent_by, run_id)
     values ($1, $2, 'out', $3, 'queued', 'agent', $4) returning id`,
    [officeId, conversationId, reply, runId],
  );
  await tx.query(
    `update public.cs_conversations set last_message_at = now(), handled_by = case when $2 then 'human' else handled_by end where id = $1`,
    [conversationId, handoff],
  );
  if (handoff) {
    const c = await one<{ customer_name: string | null; customer_wa_id: string }>(tx, `select customer_name, customer_wa_id from public.cs_conversations where id = $1`, [conversationId]);
    await addActivity(tx, officeId, "cs.handoff", `butuh kamu untuk membalas ${c?.customer_name ?? c?.customer_wa_id ?? "pelanggan"}`, agentId, { type: "conversation", id: conversationId });
  }
  return m!.id;
}

// ---------------------------------------------------------------------------
// Pengiriman lewat Cloud API
// ---------------------------------------------------------------------------

const graphUrl = () => process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com";

/** Kirim satu pesan keluar. Simulasi: langsung dianggap terkirim. Gagal: status failed + alasan. */
export async function deliver(messageId: string) {
  const d = await db();
  const m = await one<{
    id: string;
    body: string;
    customer_wa_id: string;
    mode: "cloud" | "simulation";
    phone_number_id: string;
    token_id: string | null;
    in_window: boolean;
  }>(
    d,
    `select m.id, m.body, c.customer_wa_id, w.mode, w.phone_number_id, w.access_token_secret_id as token_id,
            coalesce(c.last_customer_message_at > now() - make_interval(hours => ${WINDOW_HOURS}), false) as in_window
       from public.cs_messages m join public.cs_conversations c on c.id = m.conversation_id
       join public.wa_connections w on w.id = c.wa_connection_id
      where m.id = $1 and m.direction = 'out' and m.status = 'queued'`,
    [messageId],
  );
  if (!m) return;
  const fail = (error: string) => d.query(`update public.cs_messages set status = 'failed', error = $2 where id = $1`, [m.id, error]);
  if (m.mode === "simulation") {
    await d.query(`update public.cs_messages set status = 'sent' where id = $1`, [m.id]);
    return;
  }
  if (!m.in_window) return fail("Lewat 24 jam sejak pesan terakhir pelanggan: WhatsApp hanya mengizinkan pesan template.");
  const token = m.token_id
    ? (await one<{ secret: string }>(d, `select decrypted_secret as secret from vault.decrypted_secrets where id = $1`, [m.token_id]))?.secret
    : null;
  if (!token) return fail("Token WhatsApp untuk nomor ini belum tersimpan.");
  try {
    const res = await fetch(`${graphUrl()}/${process.env.WHATSAPP_GRAPH_VERSION || "v21.0"}/${m.phone_number_id}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: m.customer_wa_id, type: "text", text: { body: m.body } }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok || !data.messages?.[0]?.id) return fail(`WhatsApp menolak (${res.status}): ${data.error?.message ?? "tanpa keterangan"}`.slice(0, 500));
    await d.query(`update public.cs_messages set status = 'sent', wa_message_id = $2 where id = $1`, [m.id, data.messages[0].id]);
  } catch {
    await fail("Tidak bisa terhubung ke WhatsApp.");
  }
}

// ---------------------------------------------------------------------------
// Dashboard: percakapan (S25/S26)
// ---------------------------------------------------------------------------

export async function listConversations(officeId: string) {
  return many<{
    id: string;
    customer_name: string | null;
    customer_wa_id: string;
    handled_by: "agent" | "human";
    unread_count: number;
    last_message_at: string;
    mode: "cloud" | "simulation";
    last_body: string | null;
    last_sender: "customer" | "agent" | "human" | null;
  }>(
    await db(),
    `select c.id, c.customer_name, c.customer_wa_id, c.handled_by, c.unread_count, c.last_message_at, w.mode,
            l.body as last_body, l.sent_by as last_sender
       from public.cs_conversations c join public.wa_connections w on w.id = c.wa_connection_id
       left join lateral (select body, sent_by from public.cs_messages where conversation_id = c.id order by created_at desc limit 1) l on true
      where c.office_id = $1 order by c.last_message_at desc limit 100`,
    [officeId],
  );
}

export async function getConversation(officeId: string, id: string) {
  if (!UUID.test(id)) return null;
  const d = await db();
  const c = await one<{
    id: string;
    customer_name: string | null;
    customer_wa_id: string;
    handled_by: "agent" | "human";
    mode: "cloud" | "simulation";
    display_phone: string;
    agent_name: string | null;
    in_window: boolean;
  }>(
    d,
    `select c.id, c.customer_name, c.customer_wa_id, c.handled_by, w.mode, w.display_phone, a.name as agent_name,
            coalesce(c.last_customer_message_at > now() - make_interval(hours => ${WINDOW_HOURS}), false) as in_window
       from public.cs_conversations c join public.wa_connections w on w.id = c.wa_connection_id
       left join public.agents a on a.id = w.agent_id
      where c.office_id = $1 and c.id = $2`,
    [officeId, id],
  );
  if (!c) return null;
  const messages = await many<{ id: string; sent_by: "customer" | "agent" | "human"; body: string | null; media: { type: string } | null; status: string; error: string | null; created_at: string }>(
    d,
    `select id, sent_by, body, media, status, error, created_at from public.cs_messages where conversation_id = $1 order by created_at`,
    [id],
  );
  await d.query(`update public.cs_conversations set unread_count = 0 where id = $1 and unread_count > 0`, [id]);
  return { ...c, messages };
}

export async function setHandledBy(officeId: string, conversationId: string, who: "agent" | "human") {
  if (!UUID.test(conversationId)) return;
  await (await db()).transaction(async (tx) => {
    const c = await one<{ wa_connection_id: string; pending: boolean }>(
      tx,
      `update public.cs_conversations set handled_by = $3 where office_id = $1 and id = $2
       returning wa_connection_id,
         exists (select 1 from public.cs_messages m where m.conversation_id = $2 and m.direction = 'in'
                  and m.created_at > coalesce((select max(created_at) from public.cs_messages o where o.conversation_id = $2 and o.direction = 'out'), '-infinity')) as pending`,
      [officeId, conversationId, who],
    );
    // Dikembalikan ke agent dan ada pesan pelanggan yang belum dijawab: agent langsung menjawab.
    if (c && who === "agent" && c.pending) await queueReply(tx, officeId, c.wa_connection_id, conversationId);
  });
}

/** Balasan manusia dari dashboard (percakapan otomatis berpindah ke "kamu"). */
export async function sendHumanReply(officeId: string, conversationId: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "Tulis pesan dulu." };
  if (text.length > 4000) return { error: "Pesan maksimal 4.000 karakter." };
  if (!UUID.test(conversationId)) return { error: "Percakapan tidak ditemukan." };
  const d = await db();
  const m = await one<{ id: string }>(
    d,
    `with c as (update public.cs_conversations set handled_by = 'human', last_message_at = now() where office_id = $1 and id = $2 returning id)
     insert into public.cs_messages (office_id, conversation_id, direction, body, status, sent_by)
     select $1, c.id, 'out', $3, 'queued', 'human' from c returning id`,
    [officeId, conversationId, text],
  );
  if (!m) return { error: "Percakapan tidak ditemukan." };
  await deliver(m.id);
  const r = await one<{ status: string; error: string | null }>(d, `select status, error from public.cs_messages where id = $1`, [m.id]);
  return r?.status === "failed" ? { error: r.error ?? "Pesan gagal terkirim." } : { ok: true as const };
}

/** Pesan dari "pelanggan simulasi" di dashboard: jalur yang sama dengan webhook, tanpa WhatsApp. */
export async function simulateInbound(officeId: string, customerName: string, body: string) {
  const text = body.trim();
  if (!text) return { error: "Tulis pesan pelanggan dulu." };
  if (text.length > 4000) return { error: "Pesan maksimal 4.000 karakter." };
  const name = customerName.trim().slice(0, 80) || "Pelanggan simulasi";
  const connectionId = await simulationConnection(officeId);
  const waId = `sim-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
  const r = await receiveInbound({
    connectionId,
    officeId,
    customerWaId: waId,
    customerName: name,
    waMessageId: `sim-${crypto.randomUUID()}`,
    body: text,
    mediaType: null,
  });
  return { ok: true as const, conversationId: r.conversationId };
}

// ---------------------------------------------------------------------------
// Webhook Cloud API
// ---------------------------------------------------------------------------

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, body mentah). */
export function validSignature(raw: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

const WebhookBody = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).partial().optional() })).optional(),
            messages: z
              .array(z.object({ id: z.string(), from: z.string(), type: z.string(), text: z.object({ body: z.string() }).optional() }))
              .optional(),
            statuses: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
          }),
        }),
      ),
    }),
  ),
});

const STATUS_ORDER = ["queued", "sent", "delivered", "read"];

export async function handleWebhook(payload: unknown) {
  const body = WebhookBody.safeParse(payload);
  if (!body.success) return { ignored: true };
  const d = await db();
  let received = 0;
  for (const e of body.data.entry) {
    for (const ch of e.changes) {
      if (ch.field !== "messages" || !ch.value.metadata) continue;
      const conn = await one<{ id: string; office_id: string }>(
        d,
        `select w.id, w.office_id from public.wa_connections w join public.offices o on o.id = w.office_id
          where w.phone_number_id = $1 and w.mode = 'cloud' and w.status = 'active' and o.status = 'active'`,
        [ch.value.metadata.phone_number_id],
      );
      if (!conn) continue;
      for (const msg of ch.value.messages ?? []) {
        const name = ch.value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;
        await receiveInbound({
          connectionId: conn.id,
          officeId: conn.office_id,
          customerWaId: msg.from,
          customerName: name,
          waMessageId: msg.id,
          body: msg.type === "text" ? (msg.text?.body ?? "") : null,
          mediaType: msg.type === "text" ? null : msg.type,
        });
        received++;
      }
      for (const st of ch.value.statuses ?? []) {
        if (st.status === "failed") {
          await d.query(`update public.cs_messages set status = 'failed', error = 'Gagal terkirim menurut WhatsApp.' where wa_message_id = $1 and office_id = $2`, [st.id, conn.office_id]);
        } else if (STATUS_ORDER.includes(st.status)) {
          // Status hanya maju (webhook bisa datang tidak berurutan).
          await d.query(
            `update public.cs_messages set status = $2 where wa_message_id = $1 and office_id = $3
               and array_position($4::text[], status) < array_position($4::text[], $2)`,
            [st.id, st.status, conn.office_id, STATUS_ORDER],
          );
        }
      }
    }
  }
  return { received };
}
