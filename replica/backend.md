# Backend: Kantoraiku

Status per 2026-11-14, branch `build/backend-supabase` (di atas `build/vertical-slice`).
Supabase **lokal** (Docker, `supabase start`); project cloud belum dibuat.

## Menjalankan

```bash
pnpm db:start        # Supabase lokal (Docker Desktop harus jalan); menerapkan supabase/migrations
pnpm env:local       # tulis URL + kunci Supabase LOKAL ke apps/web/.env.local
pnpm seed            # admin dev; kredensial di apps/web/.data/dev-credentials.txt
pnpm dev             # http://localhost:3000
```

Email auth (reset password, link masuk) di lokal ditangkap Mailpit: http://127.0.0.1:54324.
Studio database: http://127.0.0.1:54323.

## Auth

| fitur | status | catatan |
| --- | --- | --- |
| akun dibuat saat pesanan lunas | ✅ | `auth.admin.createUser` (email terkonfirmasi), pendaftaran publik dimatikan (`enable_signup = false`) |
| atur password pertama dari halaman pesanan | ✅ | `generateLink(recovery)` → `/auth/confirm` → `/atur-password` |
| login email + password | ✅ | `signInWithPassword`, cek keanggotaan kantor |
| lupa password | ✅ | `resetPasswordForEmail`, template email sendiri (`supabase/templates/recovery.html`) |
| link masuk lewat email (magic link) | ✅ | `signInWithOtp` tanpa membuat user baru → `/kantor-saya` |
| sesi | ✅ | cookie `@supabase/ssr`, **dipaksa httpOnly** (dashboard tidak memakai client Supabase di browser); `proxy.ts` menyegarkan token |
| keluar dari semua perangkat | ⏳ | `signOut({ scope: "global" })` sudah ada di `auth.ts`, tombolnya belum |
| peran | ✅ | `owner` / `member` di `office_members`; `platform_admins` untuk panel admin |
| hapus akun / tutup kantor | ⏳ | `purge_closed_offices` (30 hari) sudah ada; tombol "tutup kantor" belum |
| OAuth (Google) | — | tidak ada di recon; tidak dibangun |

## Database

| item | status | catatan |
| --- | --- | --- |
| migrasi di repo, dijalankan skrip | ✅ | `supabase/migrations/` via `supabase start` / `db reset` |
| RLS di setiap tabel | ✅ | policy anggota kantor (lihat migrasi init); diuji 35 tes di PGlite |
| cek akses di data layer | ✅ | koneksi server (`postgres`) memfilter `office_id` dari `requireMember` / `requireAdmin` / `authDevice` |
| uji user kedua | ✅ | lihat bagian Uji: UI dan SQL, 0 baris bocor |
| pg_cron (jadwal, lease, offline, kedaluwarsa, purge, rate limit) | ✅ | jalan di Supabase; pengganti cron dev dihapus |
| seed | ✅ | `pnpm seed` (admin dev saja; data pelanggan dibuat lewat alur beli) |
| backup | ⏳ | cek "Database > Backups" di project cloud saat dibuat (harian di paket Pro) |

Keputusan: server tidak meniru JWT user untuk RLS (pola `set role authenticated`), tapi
memfilter `office_id` per query. RLS tetap aktif sebagai pagar untuk akses langsung dari
browser (mis. Realtime nanti). Ini mengikuti opsi "cek di data layer" di skill backend.

## Pembayaran

| item | status | catatan |
| --- | --- | --- |
| transfer manual + konfirmasi admin | ✅ | data rekening/WA masih dummy (env) |
| Midtrans Snap + webhook | ⏸ ditunda | menunggu akun merchant Midtrans (keputusan user) |

Stripe tidak dipakai (tidak menerima merchant Indonesia).

## Email dan jobs

| item | status | catatan |
| --- | --- | --- |
| email auth | ✅ lokal | Mailpit; production butuh SMTP kustom (Resend) dengan domain sendiri |
| email transaksional (pesanan dibuat/lunas) | ⏸ | menunggu akun Resend + domain `kantoraiku.id` |
| jobs | ✅ | pg_cron; waktu disimpan UTC, ditampilkan WIB |

## Integrasi

| integrasi | API resmi | status |
| --- | --- | --- |
| OpenAI (otak agent) | Responses API, kunci user di PC | dibangun, belum diuji dengan kunci asli |
| Anthropic (otak agent) | Agent SDK, kunci user di PC | belum |
| Sign in with ChatGPT | OAuth resmi OpenAI | ditunda (formulir minat belum diisi) |
| Midtrans | Snap + HTTP notification | ditunda |
| Repliz, ElevenLabs | API publik, kunci user di PC | Fase 2 |
| WhatsApp Cloud API | Embedded Signup (Meta Tech Provider) | Fase 3, butuh verifikasi bisnis Meta (mulai lebih awal) |

## Security checklist

- [x] rahasia hanya di env, `.env*` di `.gitignore`, tidak ada di bundle client (dicek: `.next/static` bersih dari kunci rahasia dan `DATABASE_URL`)
- [x] input divalidasi di server (zod) di setiap route perangkat dan form; server action membaca ulang data, tidak percaya client
- [x] otorisasi dicek di setiap baca/tulis, diuji dengan user kedua (UI + SQL)
- [x] rate limit di login (kantor, admin), pesan, cek alamat, kirim link/reset (per IP + email), pairing perangkat
- [ ] webhook memverifikasi signature: belum ada webhook (Midtrans ditunda); `payment_events` unik sudah siap untuk idempotensi
- [ ] upload: batas ukuran dan tipe: belum ada fitur upload (Fase 2: cover/pratinjau)
- [x] tidak ada data user di URL atau log: token atur password tidak lagi lewat URL; IP di rate limit di-hash; log server tidak mencetak email/password
- [x] dependensi diaudit: `pnpm audit --prod` tanpa kerentanan (2026-11-14)
- [ ] kebijakan privasi mencantumkan semua pemroses: halaman legal belum dibuat (pemroses: Supabase, Vercel, OpenAI/Anthropic via kunci user, Resend, Midtrans, Cloudflare)

## Uji (2026-11-14, Supabase lokal)

Alur di browser:

1. Pesan `toko-ani` (transfer manual) → cek alamat lewat Supabase + rate limit.
2. Admin login (Supabase Auth) → tandai lunas → akun pembeli dibuat lewat API Auth → kantor dibuat.
3. Pembeli: halaman pesanan → "Atur password" → masuk sebagai pembeli → atur password → `/kantor-saya` → kantor.
4. Lupa password: email dari Mailpit → link → atur password; link yang sama dibuka lagi → ditolak (`/masuk?e=link`).
5. Link masuk lewat email → `/kantor-saya` → kantor.
6. Konektor: kode setup → `pair` → riset → rantai → naskah → persetujuan menunggu → Setujui.

Isolasi (user kedua `budi@contoh.test`, kantor `studio-budi`):

| uji | hasil |
| --- | --- |
| buka `/o/toko-ani` | diarahkan ke login "bukan anggota", tidak ada data bocor |
| konten / agent Ani lewat `/o/studio-budi/...` | 404 |
| inbox persetujuan Budi | kosong |
| SQL sebagai Budi (role `authenticated` + JWT): `decide_approval` milik Ani | ditolak |
| SQL sebagai Budi: baca agent, konten, pesanan, perangkat Ani | 0 baris |
| SQL sebagai Budi: tulis agent ke kantor Ani | 0 baris |
| SQL sebagai `anon`: baca kantor, pesanan | 0 baris |
| `claim_task_run` sebagai `authenticated` | permission denied |

Ditemukan dan diperbaiki saat uji:

- **Sesi tertukar**: halaman atur password sempat terbuka dengan sesi admin yang masih aktif
  (redirect server action → route handler tidak memasang cookie baru sebelum render). Sekarang token
  ditukar jadi sesi di dalam server action yang sama (`signInForPasswordSetup`), sesi lama dikeluarkan,
  dan email akun dicocokkan; `/auth/confirm` juga mengeluarkan sesi lama sebelum `verifyOtp`.
- **"Sudah punya password"**: Supabase Auth mengisi password acak saat akun dibuat tanpa password,
  jadi penandanya diganti ke `app_metadata.password_set` (hanya bisa diubah server).
- **jsonb tersimpan sebagai string**: `postgres` v4 men-serialize parameter jsonb sendiri; `JSON.stringify`
  membuat nilainya jadi string JSON. Check constraint skema menangkapnya; sekarang objek dikirim apa adanya.

Pemeriksaan: `tsc`, `eslint`, `next build` (proxy aktif), `pnpm audit --prod` bersih.

## Yang dibutuhkan dari kamu (cloud)

1. Buat project Supabase (region Singapura), lalu `npx supabase link` dan `npx supabase db push`.
2. Isi `apps/web/.env.local` / env Vercel dari Project Settings (URL, publishable key, secret key, DATABASE_URL pooler mode transaksi).
3. Di dashboard Auth: Site URL = domain produksi, matikan sign up, salin dua template email dari `supabase/templates/`, pasang SMTP kustom (Resend) dengan domain `kantoraiku.id`.
4. Aktifkan backup (paket Pro: harian) dan cek "Database > Backups".
