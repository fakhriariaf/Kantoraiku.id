import { countWords, type CsReplyOutput, type ResearchOutput, type ScriptOutput, type GeneralOutput, type WorkPackage } from "@kantoraiku/shared";
import type { Brain } from "./types.ts";

// Otak simulasi: tanpa AI dan tanpa biaya. Hasilnya contoh yang jelas ditandai "simulasi",
// supaya alur kantor (antrean, rantai tugas, persetujuan, revisi) bisa dicoba dari ujung ke ujung.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const IDEAS = [
  { title: "Kenapa langit sore berwarna jingga?", angle: "Cahaya matahari menempuh jalan lebih panjang saat sore, warna biru tersebar duluan." },
  { title: "Rahasia kenapa roti tawar cepat keras", angle: "Bukan kering, tapi pati yang mengkristal lagi setelah dipanggang." },
  { title: "Benarkah kita hanya memakai 10% otak?", angle: "Mitos lama yang dipatahkan pemindaian otak modern." },
  { title: "Kenapa kucing suka masuk kardus?", angle: "Ruang sempit memberi rasa aman dan hangat." },
];

/**
 * Balasan CS simulasi: cari bagian info bisnis yang paling cocok dengan pesan terakhir (kata yang sama).
 * Tidak ada yang cocok -> serahkan ke manusia, seperti aturan agent sungguhan.
 */
export function simulateCsReply(cs: NonNullable<WorkPackage["context"]["cs"]>): CsReplyOutput {
  const last = [...cs.messages].reverse().find((m) => m.from === "customer")?.text ?? "";
  const words = (t: string) => new Set(t.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4));
  const asked = words(last);
  const sections = cs.businessInfo.split(/^## /m).filter(Boolean).map((sec) => {
    const [title, ...body] = sec.split("\n");
    return { title: title.trim(), body: body.join(" ").trim() };
  });
  let best: { score: number; body: string } | null = null;
  for (const s of sections) {
    const score = [...words(`${s.title} ${s.body}`)].filter((w) => asked.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { score, body: s.body };
  }
  if (!best || !best.body) {
    return { reply: "Terima kasih sudah menghubungi kami. Pertanyaan kamu kami teruskan ke tim, mohon tunggu sebentar ya.", handoff: true };
  }
  const answer = best.body.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  return { reply: `${answer} (Balasan simulasi dari info bisnis.)`, handoff: false };
}

export const simulation: Brain = async (p, progress) => {
  if (p.run.kind === "cs_reply" && p.context.cs) {
    await progress(50, "Simulasi: membalas chat dari info bisnis");
    return { output: simulateCsReply(p.context.cs), inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }
  await progress(20, "Simulasi: menyiapkan hasil contoh");
  await sleep(1500);

  if (p.run.kind === "research") {
    const out: ResearchOutput = {
      topics: IDEAS.slice(0, 3).map((t, i) => ({
        title: t.title,
        angle: t.angle,
        score: 90 - i * 7,
        sources: [{ url: `simulasi://sumber-${i + 1}`, title: "Sumber contoh (mode simulasi)" }],
      })),
    };
    await progress(80, "Simulasi: 3 topik ditemukan");
    await sleep(800);
    return { output: out, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }

  if (p.run.kind === "script") {
    const rev = p.context.revision;
    const topic = p.context.topics?.[0];
    const title = rev ? rev.title : (topic?.title ?? "Fakta singkat hari ini");
    const lines = rev
      ? [
          `Revisi sesuai catatan: ${rev.note.replace(/[.!?\s]+$/, "")}.`,
          "Pernah memperhatikan hal kecil ini? Ternyata ada penjelasan ilmiahnya.",
          topic?.angle ?? "Jawabannya lebih sederhana dari yang kamu kira.",
          "Simpan video ini dan bagikan ke teman yang suka fakta unik.",
        ]
      : [
          `${title} Kebanyakan orang tidak pernah memikirkannya, padahal jawabannya seru.`,
          topic?.angle ?? "Jawabannya ada di sekitar kita setiap hari.",
          "Bayangkan setiap hari kamu melihatnya tanpa tahu alasannya. Sekarang kamu tahu, dan kamu tidak akan melihatnya dengan cara yang sama lagi.",
          "Ini naskah contoh dari mode simulasi, jadi faktanya belum diperiksa. Ganti otak agent ke OpenAI untuk naskah sungguhan.",
          "Ikuti channel ini untuk fakta singkat lain setiap hari.",
        ];
    const script = lines.join("\n\n");
    const out: ScriptOutput = {
      title,
      script,
      visual_plan: lines.map((l, i) => ({ scene: l.slice(0, 80), visual: ["Teks judul besar", "Ilustrasi sederhana", "Close-up objek", "Logo channel dan ajakan ikuti"][i % 4] })),
    };
    await progress(80, `Simulasi: naskah ${countWords(script)} kata`);
    await sleep(800);
    return { output: out, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
  }

  const out: GeneralOutput = { summary_md: `**Simulasi** menyelesaikan tugas "${p.task.name}".` };
  return { output: out, inputTokens: 0, outputTokens: 0, costUsdMicros: 0 };
};
