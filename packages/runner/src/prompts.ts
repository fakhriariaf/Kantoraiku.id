import type { WorkPackage } from "@kantoraiku/shared";

const LANG: Record<string, string> = { id: "Bahasa Indonesia", en: "English" };

/** Instruksi sistem: identitas agent + job desk + skill + instruksi tugas. */
export function systemPrompt(p: WorkPackage, opts: { json?: boolean } = {}) {
  const lang = LANG[p.channel?.language ?? "id"] ?? "Bahasa Indonesia";
  const parts = [
    `Kamu adalah ${p.agent.name}, ${p.agent.title}, karyawan AI di sebuah kantor konten.`,
    p.agent.jobDescription && `Job desk:\n${p.agent.jobDescription}`,
    ...p.skills.map((s) => `Skill "${s.name}":\n${s.body}`),
    p.task.instructions && `Instruksi khusus tugas "${p.task.name}":\n${p.task.instructions}`,
    `Tulis semua hasil dalam ${lang}.`,
    "Jangan mengarang fakta atau sumber. Pakai URL asli dari hasil pencarian; bila tidak yakin, jangan cantumkan.",
    opts.json !== false && "Jawab hanya dalam format JSON yang diminta.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function userPrompt(p: WorkPackage) {
  const ch = p.channel;
  if (p.run.kind === "research") {
    return [
      `Cari 3 topik yang sedang ramai dibicarakan dan cocok untuk channel video pendek "${ch?.name}".`,
      ch?.niche && `Niche dan gaya channel: ${ch.niche}`,
      "Untuk tiap topik: judul yang memancing rasa ingin tahu, sudut pandang (angle) satu kalimat, skor 0-100 seberapa menarik untuk penonton channel ini, dan 1-3 sumber (url dan judul).",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (p.run.kind === "script") {
    if (p.context.revision) {
      const r = p.context.revision;
      return [
        `Revisi naskah video pendek berikut untuk channel "${ch?.name}" sesuai catatan pemilik.`,
        `Catatan revisi: ${r.note}`,
        `Judul lama: ${r.title}`,
        `Naskah lama:\n${r.script}`,
        "Kembalikan judul, naskah lengkap yang sudah direvisi, dan rencana visual per adegan.",
      ].join("\n\n");
    }
    const t = p.context.topics?.[0];
    return [
      `Tulis naskah video pendek 45-60 detik (sekitar 110-150 kata) untuk channel "${ch?.name}".`,
      ch?.niche && `Niche dan gaya channel: ${ch.niche}`,
      t ? `Topik: ${t.title}${t.angle ? `\nSudut pandang: ${t.angle}` : ""}` : "Pilih sendiri topik yang relevan dengan niche channel.",
      t?.sources.length ? `Sumber riset:\n${t.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}` : "",
      "Buka dengan kalimat yang langsung menarik perhatian di 3 detik pertama. Tutup dengan ajakan ringan.",
      "Rencana visual: pecah naskah per adegan; 'scene' = potongan narasi, 'visual' = apa yang tampil di layar.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (p.run.kind === "cs_reply" && p.context.cs) return csPrompt(p.context.cs);
  return `Kerjakan tugas "${p.task.name}". ${p.task.instructions}\nBeri hasil berupa ringkasan markdown yang rapi.`;
}

const WHO = { customer: "Pelanggan", agent: "Kamu", human: "Tim (manusia)" } as const;

/** Balasan CS WhatsApp: hanya dari info bisnis; selain itu serahkan ke manusia. */
export function csPrompt(cs: NonNullable<WorkPackage["context"]["cs"]>) {
  return [
    "Kamu membalas chat WhatsApp pelanggan atas nama bisnis ini.",
    "Aturan:",
    "- Pakai hanya informasi bisnis di bawah. Jangan mengarang harga, stok, jadwal, atau janji.",
    "- Ramah dan singkat: paling banyak 3 kalimat, tanpa format markdown. Pakai bahasa yang sama dengan pelanggan.",
    "- Bila jawabannya tidak ada di info bisnis, pelanggan komplain atau marah, atau minta bicara dengan orang: bilang tim akan membalas sebentar lagi, lalu isi handoff = true.",
    "- Selain itu handoff = false.",
    `Info bisnis:\n${cs.businessInfo || "(belum diisi)"}`,
    `Percakapan, dari yang terlama:\n${cs.messages.map((m) => `${WHO[m.from]}: ${m.text}`).join("\n")}`,
    `Tulis balasan untuk pesan terakhir ${cs.customerName ? `dari ${cs.customerName}` : "pelanggan"}.`,
  ].join("\n\n");
}
