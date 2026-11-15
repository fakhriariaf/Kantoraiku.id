// Denah kantor 2D: karakter, ruangan, dan kursi di atas gambar latar /kantor/latar.webp.
// Dipakai di server (beranda) dan klien (form agent), jadi tanpa import server.

/** Ukuran gambar latar asli. Semua koordinat di bawah dalam piksel gambar ini. */
export const MAP_W = 1536;
export const MAP_H = 1024;

export const CHARACTERS = [
  { id: "c01", desc: "Rambut pendek, kemeja navy", tags: ["laki"] },
  { id: "c02", desc: "Hijab merah marun", tags: ["perempuan", "hijab"] },
  { id: "c03", desc: "Rambut ikal, kacamata", tags: ["laki"] },
  { id: "c04", desc: "Kuncir, headset", tags: ["perempuan"] },
  { id: "c05", desc: "Batik, rambut beruban", tags: ["laki", "matang"] },
  { id: "c06", desc: "Hijab navy, jaket denim", tags: ["perempuan", "hijab"] },
  { id: "c07", desc: "Topi, hoodie, kamera", tags: ["laki"] },
  { id: "c08", desc: "Rambut panjang, gaun hijau", tags: ["perempuan"] },
  { id: "c09", desc: "Sanggul, kardigan merah", tags: ["perempuan", "matang"] },
  { id: "c10", desc: "Polo oranye", tags: ["laki"] },
  { id: "c11", desc: "Hijab biru muda, tablet", tags: ["perempuan", "hijab"] },
  { id: "c12", desc: "Rambut diikat, flanel kuning", tags: ["laki"] },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]["id"];
export type Pose = "duduk" | "berdiri";

export const CHARACTER_FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "perempuan", label: "Perempuan" },
  { id: "laki", label: "Laki-laki" },
  { id: "hijab", label: "Berhijab" },
  { id: "matang", label: "Usia matang" },
] as const;

export function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === "string" && CHARACTERS.some((c) => c.id === v);
}

/** Karakter agent: pilihan pemilik, atau karakter tetap dari id bila belum dipilih. */
export function characterFor(agentId: string, appearance: string | null | undefined): CharacterId {
  if (isCharacterId(appearance)) return appearance;
  let h = 0;
  for (const c of agentId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CHARACTERS[h % CHARACTERS.length].id;
}

export const characterDesc = (id: CharacterId) => CHARACTERS.find((c) => c.id === id)!.desc;
export const spriteUrl = (id: CharacterId, pose: Pose) => `/kantor/${id}-${pose}.webp`;
export const ROBOT_URL = "/kantor/asisten.webp";
export const OWNER_URL = "/kantor/kamu.webp";
export const BACKGROUND_URL = "/kantor/latar.webp";

/** Tinggi sprite di gambar latar (piksel asli), per pose. */
export const SPRITE_H = { duduk: 116, berdiri: 132, robot: 96, owner: 124 } as const;

/** Titik kaki di gambar latar. lift = label nama dinaikkan supaya tidak menumpuk dengan tetangganya. */
export type Spot = { x: number; y: number; pose: Pose; lift?: number };

export type RoomId = "riset" | "naskah" | "rapat" | "video" | "cs" | "lounge" | "koridor";

export const ROOMS: Record<RoomId, { label: string; spots: Spot[] }> = {
  riset: {
    label: "Ruang Riset",
    spots: [
      { x: 205, y: 316, pose: "duduk" },
      { x: 303, y: 322, pose: "duduk", lift: 24 },
      { x: 400, y: 330, pose: "duduk" },
    ],
  },
  naskah: {
    label: "Studio Naskah",
    spots: [
      { x: 604, y: 360, pose: "duduk" },
      { x: 722, y: 366, pose: "duduk", lift: 24 },
      { x: 905, y: 334, pose: "berdiri" },
    ],
  },
  rapat: {
    label: "Ruang Rapat",
    spots: [
      { x: 1395, y: 346, pose: "berdiri" },
      { x: 1140, y: 402, pose: "duduk" },
      { x: 1238, y: 406, pose: "duduk" },
      { x: 1188, y: 404, pose: "duduk", lift: 24 },
      { x: 1287, y: 406, pose: "duduk", lift: 24 },
    ],
  },
  video: {
    label: "Studio Video",
    spots: [
      { x: 252, y: 762, pose: "duduk" },
      { x: 160, y: 724, pose: "berdiri", lift: 24 },
    ],
  },
  cs: {
    label: "Meja CS",
    spots: [
      { x: 782, y: 768, pose: "duduk" },
      { x: 873, y: 774, pose: "duduk", lift: 24 },
      { x: 965, y: 770, pose: "duduk" },
    ],
  },
  lounge: {
    label: "Lounge",
    spots: [
      { x: 578, y: 655, pose: "berdiri" },
      { x: 660, y: 705, pose: "berdiri", lift: 24 },
    ],
  },
  koridor: {
    label: "Koridor",
    spots: [
      { x: 560, y: 485, pose: "berdiri" },
      { x: 940, y: 490, pose: "berdiri" },
      { x: 330, y: 470, pose: "berdiri" },
      { x: 1180, y: 505, pose: "berdiri" },
      { x: 740, y: 500, pose: "berdiri" },
      { x: 1310, y: 505, pose: "berdiri" },
    ],
  },
};

export const ROBOT_SPOT = { x: 692, y: 772 };
export const OWNER_SPOT = { x: 1085, y: 392 };

const RULES: [RoomId, RegExp][] = [
  ["cs", /\b(cs|whatsapp|wa|pelanggan|customer|admin chat|layanan)\b/],
  ["video", /video|render|thumbnail|kamera|animasi/],
  ["rapat", /manajer|manager|kepala|\blead\b|direktur|strategi|perencana|planner|koordinator/],
  ["naskah", /naskah|penulis|caption|copy|script|skrip|sunting|konten|artikel|tulis/],
  ["riset", /riset|periset|research|analis|data|tren|trend|kompetitor|seo/],
];

/** Ruangan agent dari jabatannya. Tidak cocok dengan apa pun: lounge. */
export function roomFor(title: string): RoomId {
  const t = title.toLowerCase();
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "lounge";
}

export type Placeable = { id: string; title: string; desk_index: number | null; created_at?: string | Date };

const time = (v: string | Date | undefined) => (v ? new Date(v).getTime() : 0);

/**
 * Tempatkan agent ke kursi ruangannya, urut desk_index. Ruangan penuh: ke lounge, lalu koridor.
 * Agent yang tidak kebagian tempat tidak tampil di denah (dihitung di `hidden`).
 */
export function placeAgents<T extends Placeable>(agents: T[]) {
  const free: Record<RoomId, Spot[]> = Object.fromEntries(
    Object.entries(ROOMS).map(([k, r]) => [k, [...r.spots]]),
  ) as Record<RoomId, Spot[]>;
  const sorted = [...agents].sort(
    (a, b) => (a.desk_index ?? 1e9) - (b.desk_index ?? 1e9) || time(a.created_at) - time(b.created_at) || a.id.localeCompare(b.id),
  );
  const placed: { agent: T; room: RoomId; spot: Spot }[] = [];
  const hidden: T[] = [];
  for (const agent of sorted) {
    const home = roomFor(agent.title);
    const room = ([home, "lounge", "koridor"] as RoomId[]).find((r) => free[r].length > 0);
    if (!room) {
      hidden.push(agent);
      continue;
    }
    placed.push({ agent, room, spot: free[room].shift()! });
  }
  return { placed, hidden };
}

/** Kursi pertama ruangan agent, untuk pratinjau di form. */
export const previewSpot = (title: string) => ROOMS[roomFor(title)].spots[0];
