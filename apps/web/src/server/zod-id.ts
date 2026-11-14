import { z } from "zod";

// Pesan validasi bawaan zod dalam Bahasa Indonesia sebagai cadangan.
// Kolom yang dilihat pengguna tetap diberi pesan sendiri yang lebih ramah (lihat orders.ts, office.ts).
z.config(z.locales.id());
