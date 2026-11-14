import { handleWebhook, validSignature } from "@/server/cs";

// Webhook WhatsApp Cloud API (app Meta milik Kantoraiku).
// GET: verifikasi saat mendaftarkan URL webhook. POST: pesan masuk dan status kirim.

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("Token verifikasi salah.", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Tanda tangan tidak valid." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON tidak valid." }, { status: 400 });
  }
  try {
    return Response.json(await handleWebhook(payload));
  } catch (e) {
    // 500 membuat Meta mengirim ulang; pesan yang sudah tersimpan diabaikan lewat wa_message_id unik.
    console.error("[webhook whatsapp]", e);
    return Response.json({ error: "Kesalahan server" }, { status: 500 });
  }
}
