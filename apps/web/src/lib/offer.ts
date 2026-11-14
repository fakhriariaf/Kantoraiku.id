/**
 * Isi penawaran yang dipakai bersama oleh landing (S01), halaman beli (S03) dan dokumen legal (S09).
 * Klaim di sini harus sesuai yang sudah jalan. Fitur yang belum dibangun ditandai `soon`
 * dan dipindah ke `available` begitu selesai.
 */

/** Yang didapat pembeli, tampil di kartu harga. */
export const planFeatures = [
  "Agent konten: riset topik, naskah, persetujuan dari HP",
  "Tugas terjadwal dan berantai, mode manual atau otomatis",
  "Alamat kantor sendiri",
  "Konektor untuk PC Windows",
  "Biaya AI langsung ke penyedia lewat API key kamu",
  "Semua pembaruan berikutnya, termasuk fitur yang sedang dibangun",
];

/** Garansi uang kembali (hari sejak kantor aktif). Ubah bersama kebijakan refund. */
export const REFUND_DAYS = 7;
/** Bila kantor belum aktif selama ini setelah bukti transfer dikirim, refund penuh. */
export const ACTIVATION_LIMIT_HOURS = 48;

export type Availability = "available" | "soon";

export const brains: { name: string; how: string; status: Availability }[] = [
  { name: "OpenAI", how: "API key milik kamu", status: "available" },
  { name: "Claude", how: "API key milik kamu", status: "soon" },
  { name: "Gemini", how: "API key milik kamu", status: "soon" },
];

/** Bagian alur yang belum dibangun. Dipakai landing dan FAQ. */
export const roadmap: { key: string; title: string; text: string }[] = [
  {
    key: "video",
    title: "Video dari naskah",
    text: "Naskah yang kamu setujui dirender jadi video di PC kamu: suara narasi, footage, dan teks. File videonya tidak pernah diunggah ke server.",
  },
  {
    key: "publish",
    title: "Posting terjadwal",
    text: "Video yang lolos persetujuan diposting ke akun media sosial kamu pada jam yang kamu pilih per channel.",
  },
  {
    key: "cs",
    title: "CS WhatsApp",
    text: "Agent CS menjawab pertanyaan pelanggan di nomor WhatsApp Business kamu, berdasarkan info bisnis yang kamu tulis.",
  },
];

/** Syarat minimum PC, dipakai di landing dan kebijakan refund. */
export const PC_MINIMUM = "Windows 10 atau 11 64-bit, RAM 8 GB, dan internet yang stabil";

export const requirements: { title: string; text: string }[] = [
  {
    title: "PC Windows",
    text: `${PC_MINIMUM}. Agent bekerja selama PC ini menyala.`,
  },
  {
    title: "API key OpenAI",
    text: "Dibuat di akun OpenAI kamu sendiri. Biaya pemakaian ditagih OpenAI langsung ke kamu, sesuai pemakaian.",
  },
  {
    title: "HP untuk menyetujui",
    text: "Dashboard dibuka dari browser HP mana pun. Tidak perlu memasang aplikasi.",
  },
];
