# Architecture: Kantoraiku (rebuild fitur inti Kantorin)

Dibuat dari `replica/recon.md` dan `replica/features.csv` pada 2026-11-14.
Nama **Kantoraiku**, domain **kantoraiku.id**. Di kode, domain tetap dibaca dari env
`APP_DOMAIN` supaya bisa dites di domain lain. Warna, logo, dan copy final ditentukan
di `/replica-brand`.

## Keputusan yang sudah diambil

| keputusan | pilihan | sumber |
| --- | --- | --- |
| Login AI: Claude | **API key milik user** (BYOK), hanya tersimpan di PC/VPS | user, aturan Agent SDK Anthropic |
| Login AI: OpenAI | **API key milik user** saja untuk sekarang. Formulir minat Sign in with ChatGPT belum diisi; login ChatGPT ditunda ke Fase 4 dan tetap di balik flag `CHATGPT_PLAN_LOGIN` | user (2026-11-14), dokumentasi OpenAI |
| Pembayaran | **Transfer manual dulu**: admin mengonfirmasi setelah pembeli kirim bukti lewat WhatsApp. **Midtrans Snap** menyusul setelah akun merchant dibuat | user (2026-11-14) |
| Nama dan domain | **Kantoraiku**, **kantoraiku.id** | user (2026-11-14) |
| Harga | **Rp299.000 sekali bayar, lifetime**. Biaya AI dibayar user langsung ke Anthropic/OpenAI lewat API key-nya | user (2026-11-14) |
| Stack | **Next.js + Supabase** | user |
| Platform | dashboard web + konektor PC (Windows dulu, lalu Mac) + konektor VPS | recon |
| Bukan yang diambil | login langganan Claude, WhatsApp Web tidak resmi, menumpang login Codex CLI (`~/.codex/auth.json`, `chatgpt.com/backend-api`) | aturan penyedia |

Kenapa ChatGPT login dikunci: dokumentasi OpenAI menyebut kuota paket ChatGPT
tersedia untuk partner open-source dan klien privat terpilih; aplikasi berbayar
atau yang di-host diminta mengisi formulir minat dulu. Kantoraiku adalah aplikasi
berbayar, jadi daftar dulu, lalu nyalakan flag-nya setelah disetujui. Kodenya sudah
bisa dibangun sekarang.

Akibatnya untuk pitch: Kantorin menjual "tanpa biaya kuota AI, pakai langganan kamu".
Dengan API key, user membayar per token ke Anthropic/OpenAI. Kantoraiku menebusnya
dengan **anggaran AI bulanan + biaya per tugas yang terlihat** (fitur yang tidak
dimiliki aslinya) dan mode hemat yang benar-benar terukur.

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js 16 (App Router) + TypeScript; `proxy.ts` me-rewrite `{slug}.{APP_DOMAIN}` ke `/o/[slug]/...` | satu codebase untuk landing, checkout, dashboard multi-tenant, panel admin, dan API perangkat |
| styling | Tailwind CSS v4, token dari `/replica-design` | cepat, token jadi satu sumber |
| mobile | tidak ada app native: dashboard responsif + PWA (Web Push di Fase 2) | "Setujui dari HP" cukup lewat browser |
| database | Supabase Postgres, region Singapura (`ap-southeast-1`) | terdekat ke Indonesia; RLS, Realtime, pg_cron, Storage, Vault dalam satu layanan |
| akses data | SQL lewat `postgres` (postgres-js, pooler mode transaksi) di server dengan cek `office_id` per query (`requireMember`/`requireAdmin`/`authDevice`); RLS menjaga semua akses langsung dari browser | satu jalur data, transaksi tersedia; lihat `replica/backend.md` |
| migrasi | SQL murni lewat Supabase CLI (`supabase/migrations/*.sql`, dimulai dari `20261114000000_init.sql`) | skema ada di satu tempat |
| auth user | Supabase Auth: email + password, magic link, reset password; cookie di domain induk `.{APP_DOMAIN}` | login sekali untuk semua subdomain kantor |
| auth perangkat | token bearer acak 32 byte dari pairing kode setup; hanya `sha256` di `devices.token_hash` | perangkat bukan user; bisa dicabut satu per satu |
| payments | Midtrans Snap (QRIS, VA, e-wallet, kartu) + transfer manual dengan konfirmasi admin | keputusan user; Stripe tidak menerima merchant Indonesia |
| email | Resend (email transaksional + SMTP kustom untuk Supabase Auth) | deliverability, domain sendiri |
| jobs | Supabase pg_cron memanggil fungsi SQL (lihat Jobs); Vercel Cron harian untuk pembersihan Storage | jadwal tugas tinggal di samping datanya, tanpa layanan tambahan |
| files | Supabase Storage: cover kecil, pratinjau video sementara | video final tetap di PC |
| hosting | Vercel; domain wildcard `*.{APP_DOMAIN}` (nameserver di Vercel agar SSL wildcard terbit) | |
| konektor | Electron + TypeScript (electron-builder NSIS/DMG, electron-updater); inti runner = paket Node biasa yang juga dipakai VPS (systemd) | Node dibutuhkan kedua SDK agent; tray, auto-update, safeStorage sudah ada |
| runtime AI | Claude: `@anthropic-ai/claude-agent-sdk` dengan `ANTHROPIC_API_KEY` user. OpenAI: Codex SDK/CLI dengan API key user; Sign in with ChatGPT lewat OIDC + PKCE di PC (flag) | keputusan user + aturan penyedia |
| rahasia | ECIES X25519 + HKDF-SHA256 + AES-256-GCM lewat WebCrypto (`sealSecret` di packages/shared): browser mengenkripsi ke public key perangkat; private key di konfigurasi konektor (nanti Electron `safeStorage`) | server tidak pernah melihat kunci asli; satu implementasi untuk browser dan Node, tanpa libsodium |
| video (Fase 2) | Remotion di PC untuk render, `@remotion/player` di dashboard untuk pratinjau live | komponen yang sama untuk render dan pratinjau |
| kantor 3D (Fase 4) | React Three Fiber | |
| WhatsApp (Fase 3) | WhatsApp Cloud API lewat Embedded Signup (Meta Tech Provider) | jalur resmi |
| monorepo | pnpm workspaces + Turborepo: `apps/web`, `apps/connector`, `packages/runner`, `packages/shared` (zod, tipe, skema output agent) | satu bahasa, kontrak dibagi |
| error tracking | Sentry (web + Electron) | |

Satu database, tanpa microservice. Server kami hanya menyimpan dashboard;
pekerjaan berat jalan di PC/VPS user, sama seperti aslinya.

## Schema

Tables: **30** (lihat `supabase/migrations/`; `rate_limits` ditambahkan di backend). Access rules: **RLS** untuk
semua akses dari browser + **cek di data layer** untuk route service.

| grup | tabel |
| --- | --- |
| platform | `platform_admins`, `reserved_slugs` |
| jual-beli | `orders`, `payment_events`, `offices`, `office_members` |
| perangkat | `devices`, `device_secrets`, `setup_codes` |
| kantor | `agents`, `skills`, `agent_skills`, `tasks`, `task_runs`, `activity_events`, `assistant_messages` |
| konten | `channels`, `topics`, `contents`, `approvals`, `video_templates`, `channel_template_versions`, `social_accounts`, `channel_accounts` |
| CS | `business_infos`, `wa_connections`, `cs_conversations`, `cs_messages` |
| notifikasi | `push_subscriptions` |

Aturan yang dipakai di semua tabel:

- `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (trigger), waktu `timestamptz` UTC.
- `office_id` di semua data milik kantor. Referensi di dalam kantor memakai
  **composite foreign key** `(office_id, x_id)`, jadi baris kantor A tidak bisa
  menunjuk agent/tugas/perangkat kantor B walaupun UUID-nya ditebak.
- Uang: `orders.amount` rupiah utuh + `currency 'IDR'`; anggaran AI
  `ai_budget_cents` + `USD`; biaya run `cost_usd_micros` (1 USD = 1.000.000).
- Status pakai `check`, bukan enum (mudah dimigrasi).
- `on delete` diputuskan per relasi: data kerja ikut terhapus bersama kantor;
  `orders` dan `payment_events` tetap ada (kewajiban pembukuan), `office_id`
  jadi null.

Policy RLS:

| akses | tabel |
| --- | --- |
| anggota baca-tulis | `agents`, `skills`, `agent_skills`, `channels`, `channel_template_versions`, `social_accounts`, `channel_accounts`, `tasks`, `business_infos`, `device_secrets` |
| anggota baca saja (ditulis server/perangkat) | `devices`, `task_runs`, `topics`, `contents`, `approvals`, `activity_events`, `cs_*`, `wa_connections`, `assistant_messages` |
| hak kolom saja | `offices` (owner: `display_name`, `timezone`, `saver_mode`, `ai_budget_cents`), `devices` (`name`), `topics` (`status`) |
| server saja | `platform_admins`, `reserved_slugs`, `payment_events`, `setup_codes` |
| lainnya | `orders` (anggota baca pesanan kantornya), `video_templates` (semua user login baca), `push_subscriptions` (milik sendiri) |

Batasan keras dari recon yang ditegakkan di database, bukan di UI:

- **Slug unik**: `offices.slug` unik + indeks unik parsial `orders(office_slug) where status='pending'`, jadi dua pembeli tidak bisa memesan slug yang sama sambil menunggu bayar. `reserved_slugs` dicek di app.
- **Satu perangkat per run**: `claim_task_run()` memakai `FOR UPDATE SKIP LOCKED`.
- **Jadwal tidak dobel**: indeks unik `task_runs(task_id, scheduled_for)`.
- **Satu keputusan per review**: indeks unik parsial `approvals(content_id, stage) where decision is null` + `decide_approval()` atomik.
- **Rantai tugas tidak melingkar**: trigger `tasks_no_cycle`.
- **Revisi wajib catatan**: check `revise_needs_note`.

Diuji: skema awal dijalankan di Postgres (PGlite) dengan stub Supabase; 35 tes
lulus (isolasi RLS, FK lintas kantor, slug, antrean, klaim, mode hemat, setujui,
revisi, lease, purge).

## Alur kerja perangkat

```
Dashboard (Vercel)                      Supabase                         Konektor (PC / VPS)
------------------                      --------                         -------------------
                                        pg_cron tiap menit
                                        enqueue_due_tasks() -> task_runs (queued)
                                                                          tiap 15 dtk (Fase 1) /
                                                                          saat dibangunkan (Fase 3):
POST /api/device/runs/claim  <---------------------------------------------- minta kerja
  claim_task_run(device) -> run + agent + skills + input ---------------->  tulis SKILL.md / AGENTS.md
                                                                            jalankan Agent SDK / Codex
POST /api/device/runs/:id/progress <---------------------------------------- % + pesan (perpanjang lease)
POST /api/device/runs/:id/complete <---------------------------------------- output.json tervalidasi zod
  -> topics / contents / approvals / biaya / rantai berikutnya
  -> activity_events --Realtime--> dashboard & HP berubah live
```

- **Lease** 15 menit, diperpanjang oleh progress/heartbeat. PC mati di tengah jalan:
  `requeue_expired_leases()` mengembalikan run ke antrean (maks 3 kali).
- **PC mati**: run tetap `queued` dan jalan saat PC menyala. Dashboard
  menampilkan "PC offline · 3 tugas menunggu".
- **Kemampuan**: PC punya `{agents, video}`, VPS `{agents}`. Run `video` hanya
  diambil PC.
- **Kontrak output**: setiap `tasks.kind` punya JSON Schema di `packages/shared`
  (research → `topics[]`; script → `{title, script, visual_plan[], word_count, duration_s}`).
  Agent menulis `output.json` di workspace-nya; runner memvalidasi sebelum kirim;
  server memvalidasi lagi. Sama untuk Claude dan OpenAI.
- **Workspace**: `%APPDATA%/Kantoraiku/offices/{slug}/agents/{agent}/`. Skill dari DB
  ditulis sebagai `.claude/skills/{slug}/SKILL.md` (Claude, `settingSources: ['project']`)
  atau digabung ke `AGENTS.md` (Codex).
- **Alat yang diizinkan** per jenis tugas: riset = `WebSearch`, `WebFetch`, `Read`, `Write`;
  naskah = `Read`, `Write`; **tanpa `Bash`** dan tanpa akses di luar workspace secara
  default. Codex jalan dengan sandbox `workspace-write`. `maxTurns` dan batas biaya per run.
- **Biaya**: `total_cost_usd` dari hasil Agent SDK (atau token × harga untuk OpenAI)
  → `task_runs.cost_usd_micros` → mode hemat.
- **Branding**: boleh "Powered by Claude"; tidak boleh menyebut produk "Claude Code"
  atau meniru tampilannya (pedoman Agent SDK).

## API

Server action = fungsi Next.js yang dipanggil dari form dashboard (session user,
RLS berlaku). Route `/api/device/*` memakai `Authorization: Bearer <device token>`.

### F01 Beli kantor

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET `/api/slug-available` | cek format, `reserved_slugs`, `offices`, pesanan pending | publik, rate limit 30/menit/IP | `?slug` | `{available, reason}` | F01 |
| action `createOrder` | buat `orders` (+ transaksi Snap, atau instruksi transfer manual, berlaku 72 jam) | publik, rate limit + Cloudflare Turnstile | `{name, email, whatsapp, slug, method}` | `{orderToken, snapToken?}` | F01 |
| GET `/pesanan/[token]` (page S05) | status, tombol bayar, rekening + tombol "Konfirmasi via WhatsApp" (`wa.me` dengan kode pesanan), lalu link buka kantor | pemegang token | | halaman | F01 |
| GET `/api/orders/[token]` | polling status setelah bayar | pemegang token | | `{status, officeUrl?}` | F01 |
| POST `/api/webhooks/midtrans` | verifikasi `signature_key` (SHA512), cek ulang ke Get Status API, catat `payment_events` (unik), `settlement`/`capture` → `provisionOffice()` | Midtrans | notifikasi JSON | `200` | F01 |
| action `adminConfirmManualPayment` | tandai lunas setelah bukti transfer dicek → `provisionOffice()` | platform admin | `{orderId, note}` | `{officeUrl}` | F01 |
| action `adminCancelOrder` / `adminExtendOrder` | batalkan / perpanjang pesanan manual | platform admin | `{orderId}` | ok | F01 |

`provisionOffice(orderId)` (internal, idempoten lewat `offices.order_id` unik): buat
atau pakai ulang user Supabase Auth dari email, buat `offices` + `office_members`
(owner) + agent asisten bawaan, kirim email "Atur password & buka kantor".

### F11 Masuk

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `requestOfficeLinks` | email daftar kantor milik email itu; respons selalu sama (anti-enumerasi) | publik, rate limit | `{email}` | ok | F11 |
| Supabase `signInWithPassword` | login di `{slug}.{APP_DOMAIN}/masuk`, lalu cek keanggotaan kantor | user | `{email, password}` | cookie sesi | F11 |
| GET `/auth/confirm` | `verifyOtp(token_hash, type)` untuk undangan, reset, magic link | link di email | `?token_hash&type&next` | redirect | F01, F11 |
| action `sendPasswordReset` | `resetPasswordForEmail` | publik, rate limit | `{email}` | ok | F11 |
| action `updatePassword` | atur password (undangan/reset) | user bersesi | `{password}` | ok | F11 |
| action `signOut` | | user | | redirect | F11 |

### F02 Perangkat dan kunci

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createSetupCode` | kode 8 karakter, berlaku 1 jam, sekali pakai; hanya hash disimpan | owner | `{officeId}` | `{code, expiresAt}` | F02 |
| POST `/api/device/pair` | tukar kode → device token; cek slot PC (`pc_slots`) dan maks 1 VPS | konektor + kode setup | `{setupCode, kind, name, publicKey, version}` | `{deviceId, deviceToken, officeSlug}` | F02 |
| POST `/api/device/heartbeat` | `last_seen_at`, online, `ai_status`, versi; perpanjang lease run aktif | perangkat | `{aiStatus, version, capabilities, activeRunIds}` | `{hasWork, minVersion}` | F02 |
| GET `/api/device/secrets` | ciphertext untuk perangkat ini | perangkat | | `[{kind, ciphertext, updatedAt}]` | F02 |
| action `saveDeviceSecret` / `deleteDeviceSecret` | simpan ciphertext yang dienkripsi di browser (S30) | anggota | `{deviceId, kind, ciphertext, hint}` | ok | F02 |
| action `renameDevice` / `revokeDevice` | cabut: token mati, run aktif kembali ke antrean, kunci perangkat itu dihapus | owner | `{deviceId}` | ok | F02 |
| GET `/api/connector/latest` | versi terbaru + URL installer + sha256 | publik | `?os` | `{version, url, sha256}` | F02 |

### F06, F07 Agent, skill, tugas

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createAgent` / `updateAgent` / `archiveAgent` | arsip membatalkan run `queued` agent itu | anggota | nama, jabatan, job desk, warna, brain, model, auth_mode | agent | F06 |
| action `createSkill` / `updateSkill` / `deleteSkill` | | anggota | `{slug, name, description, body_md}` | skill | F06 |
| action `setAgentSkills` | | anggota | `{agentId, skillIds[]}` | ok | F06 |
| action `createTask` / `updateTask` / `deleteTask` | pemicu jam / setelah tugas lain / manual; trigger DB menghitung `next_run_at` | anggota | `{agentId, channelId?, kind, trigger, scheduleTimes, scheduleDays, afterTaskId, priority}` | task | F07 |
| action `runTaskNow` | insert `task_runs` manual (lewat server, agent/channel disalin dari tugas) | anggota | `{taskId}` | `{runId}` | F07 |
| action `updateOfficeSettings` | nama, zona waktu (hitung ulang `next_run_at`), anggaran AI, mode hemat | owner | | ok | F03 |

### F03, F04, F05 Konten dan persetujuan

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| action `createChannel` / `updateChannel` | | anggota | nama, niche, bahasa, jam posting, video_mode | channel | F03 |
| action `setChannelMode` | manual ↔ otomatis; reset `consecutive_failures` | anggota | `{channelId, mode}` | ok | F05 |
| POST `/api/device/runs/claim` | `claim_task_run()` + rakit paket kerja | perangkat | `{}` | `{run, agent, skills[], task, input, outputSchema}` atau `204` | F03 |
| POST `/api/device/runs/[id]/progress` | `running`, %, pesan, perpanjang lease, aktivitas | perangkat pemegang lease | `{pct, message}` | `{cancel}` | F03 |
| POST `/api/device/runs/[id]/complete` | validasi output per `kind` → tulis `topics`/`contents`; channel manual → `approvals` + notifikasi, otomatis → langsung rantai berikutnya; biaya; status agent; gagal → `consecutive_failures`, 2× gagal render / gagal posting → kembali ke manual | perangkat pemegang lease (idempoten) | `{status, resultMd, output, costUsdMicros, tokens, error}` | `{ok}` | F03, F05 |
| RPC `decide_approval` lewat action `decideApproval` | Setujui → lanjut rantai; Revisi → run revisi dengan catatan; Tolak → diarsip | anggota | `{approvalId, decision, note}` | approval | F03, F04 |
| action `setTopicStatus` | pilih/buang topik | anggota | `{topicId, status}` | ok | F03 |

### Fase 2: video dan posting

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST `/api/device/contents/[id]/upload-url` | signed upload URL: cover ≤ 200 KB, pratinjau ≤ 25 MB (berlaku 7 hari) | perangkat | `{kind}` | `{url, path}` | F03 |
| POST `/api/device/social-accounts` | sinkron daftar akun dari Repliz (kunci Repliz ada di PC) | perangkat | `[{platform, handle, replizId}]` | ok | F03 |
| action `saveTemplateVersion` / `setActiveTemplate` | versi template channel | anggota | caption, look, voice, intro, outro | version | F10 |
| action `subscribePush` / `unsubscribePush` | Web Push untuk "Setujui dari HP" | user | subscription | ok | F03 |

### Fase 3: CS WhatsApp

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET `/api/webhooks/whatsapp` | verifikasi `hub.challenge` | Meta | | challenge | F08 |
| POST `/api/webhooks/whatsapp` | cek `X-Hub-Signature-256`, simpan `cs_messages` (unik `wa_message_id`), antrekan run `cs_reply`, bangunkan perangkat | Meta | webhook | `200` | F08 |
| POST `/api/whatsapp/embedded-signup` | tukar code Embedded Signup → token ke Supabase Vault, daftar nomor, subscribe webhook | owner | `{code}` | `wa_connection` | F08 |
| action `businessInfo` CRUD | sumber jawaban CS | anggota | | | F08 |
| action `takeOverConversation` / `sendHumanReply` | manusia ambil alih chat | anggota | | | F08 |

Run `cs_reply` selesai → server mengirim balasan lewat Cloud API (token di Vault),
hanya di dalam jendela 24 jam sejak pesan terakhir pelanggan.

### Fase 4

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET `/install/vps.sh` | skrip yang ditempel user di terminal VPS: pasang runner headless + pairing pakai kode setup | publik (kode setup wajib) | | skrip | F09 |
| POST `/api/device/assistant/[tool]` | alat asisten setup (buat agent/skill/tugas/channel) dengan scope perangkat, dikonfirmasi user di chat | perangkat | | | F02 |
| action `buyPcSlot` | `createOrder` dengan `kind = 'pc_slot'` | owner | | | F12 |

Total: **45 baris route/action** (7 F01, 6 F11, 7 F02, 6 F06/F07, 7 F03–F05, 4 Fase 2, 5 Fase 3, 3 Fase 4); beberapa baris menggabungkan aksi CRUD sejenis.

Webhooks in: Midtrans HTTP notification; WhatsApp Cloud API (Fase 3).
Webhooks out: tidak ada.
API pihak ketiga, server: Midtrans Snap + Get Status, Resend, Supabase Auth admin,
WhatsApp Cloud API (Fase 3). Dari perangkat, dengan kunci user: Anthropic,
OpenAI, ElevenLabs, Repliz.

Jobs:

| nama | jadwal (UTC) | does |
| --- | --- | --- |
| `enqueue-due-tasks` | tiap menit (pg_cron) | buat `task_runs` untuk jadwal jatuh tempo, majukan `next_run_at` |
| `requeue-expired-leases` | tiap menit (pg_cron) | run tanpa kabar > lease → antre lagi / gagal setelah 3 kali |
| `mark-devices-offline` | tiap menit (pg_cron) | perangkat tanpa heartbeat 3 menit → offline (Realtime ke dashboard) |
| `expire-pending-orders` | tiap 15 menit (pg_cron) | pesanan lewat batas → `expired`, slug bebas lagi |
| `purge-closed-offices` | 20.00 UTC = 03.00 WIB (pg_cron) | hapus data kerja 30 hari setelah kantor ditutup |
| `cleanup-previews` | harian (Vercel Cron, Fase 2) | hapus pratinjau video kedaluwarsa dari Storage |

## The parts that bite

- **Zona waktu**: jadwal disimpan sebagai jam lokal + hari, dihitung dengan `offices.timezone` (WIB/WITA/WIT). Indonesia tanpa DST, tapi fungsi `next_run_after()` sudah benar untuk zona ber-DST. Ganti zona waktu → hitung ulang semua `next_run_at`.
- **Idempotensi**: notifikasi Midtrans datang dobel dan tidak berurutan → `payment_events` unik, transisi status hanya maju, `provisionOffice()` idempoten. `complete` dari perangkat bisa dikirim ulang → cek `status in (claimed, running) and device_id = pengirim`. Webhook WhatsApp → unik `wa_message_id`.
- **Race**: slug (indeks parsial), klaim run (`SKIP LOCKED`), klik Setujui dobel / dua HP (`decide_approval` atomik), dua perangkat (kemampuan + lease).
- **Rate limit**: API key user kena rate limit Anthropic/OpenAI → runner backoff, run dicoba lagi. Endpoint publik (`slug-available`, `createOrder`, `requestOfficeLinks`, reset) dibatasi per IP + Turnstile. Endpoint perangkat dibatasi per token.
- **Ukuran file**: video tidak pernah ke server. Cover ≤ 200 KB, pratinjau ≤ 25 MB dengan masa berlaku.
- **Realtime**: Supabase Realtime `postgres_changes` (RLS berlaku) untuk feed, status agent, antrean, persetujuan. Membangunkan perangkat (Fase 3, CS butuh cepat): broadcast ke channel `device:{id}:{nonce}` dengan isi `{type: "wake"}` saja; polling turun ke 60 detik.
- **Offline**: inti produk. Run menunggu, lease habis → antre lagi, dashboard tetap jalan.
- **Deliverability email**: SPF, DKIM, DMARC di domain sendiri lewat Resend; Supabase Auth memakai SMTP Resend.
- **Multi-tenancy**: subdomain hanya menunjuk kantor; akses selalu dicek lewat `office_members`. Cookie di `.{APP_DOMAIN}`. Composite FK mencegah referensi lintas kantor.
- **Keamanan di PC user**: agent membaca web (riset) lalu bisa terkena prompt injection. Karena itu tanpa `Bash`, file hanya di workspace, sandbox Codex, `maxTurns` + batas biaya. Konektor tidak pernah menjalankan perintah dari server selain paket kerja tervalidasi.
- **Rahasia**: perangkat dipasang ulang → keypair baru → kunci harus diisi ulang (UI mengingatkan). Kunci juga bisa diketik langsung di konektor tanpa lewat dashboard.
- **UU PDP 27/2022**: ekspor dan hapus data atas permintaan; untuk data pelanggan CS, user adalah pengendali data, kami pemroses.
- **Distribusi konektor**: installer Windows perlu code signing (mis. Azure Trusted Signing), kalau tidak SmartScreen memperingatkan; Mac perlu notarisasi (Apple Developer). Antivirus bisa memblokir proses agent.
- **Biaya polling**: polling 15 detik × banyak PC = banyak invocation Vercel. Pindah ke broadcast "wake" + polling 60 detik sebelum ratusan pengguna.

## Build order

Perkiraan durasi untuk satu developer full-time, kasar.

1. **Vertical slice (1–2 minggu)**: alur inti dari ujung ke ujung, tampilan polos.
   - Screens: S03 (transfer manual saja), S05, A01–A02 (admin pesanan, baru), S10, S29, S33 (build dev Windows; API key Claude diketik di konektor), S13/S14 (form dasar), S16 (manual + setelah tugas lain), S17 (satu channel), S21/S22, S12 (daftar polos).
   - Tables: `orders`, `offices`, `office_members`, `platform_admins`, `setup_codes`, `devices`, `agents`, `channels`, `tasks`, `task_runs`, `topics`, `contents`, `approvals`, `activity_events`.
   - Routes: `createOrder`, `/pesanan/[token]`, `adminConfirmManualPayment`, `provisionOffice`, `/auth/confirm`, `updatePassword`, `createSetupCode`, `/api/device/pair`, `heartbeat`, `runs/claim`, `runs/[id]/complete`, `createAgent`, `createChannel`, `createTask`, `runTaskNow`, `decide_approval`.
   - Selesai bila: beli (manual) → admin konfirmasi → atur password → pasangkan PC → "Jalankan sekarang" pada tugas riset → penulis jalan otomatis → naskah muncul di S21 → Setujui dari HP → tercatat di feed.

2. **Must-haves Fase 1: teks (3–4 minggu)**
   - jual-beli: Midtrans Snap + webhook + Get Status (setelah akun Midtrans dibuat; sampai itu hanya transfer manual), `slug-available`, email Resend, `expire-pending-orders`, landing S01 + legal S09 dengan copy sendiri.
   - auth: `proxy.ts` subdomain, S06 `requestOfficeLinks`, S07 reset.
   - konektor: installer NSIS + signing + auto-update, S30 kunci via sealed box, `ai_status`, antrean saat offline, lease, `mark-devices-offline`, Realtime di dashboard.
   - agent: S15 skill → SKILL.md/AGENTS.md, jadwal pg_cron, **brain OpenAI (Codex) dengan API key**, status agent.
   - konten: S18 mode manual/otomatis, alur revisi, S23 tahap konten, responsif HP, Bahasa Indonesia.
   - kantor: S11 denah 2D, S12 feed.
   - Tables tambahan: `skills`, `agent_skills`, `device_secrets`, `payment_events`, `reserved_slugs`.

3. **Should-haves Fase 1 (1–2 minggu)**: anggaran AI + biaya per run + mode hemat (`office_saver_active`), riwayat run + error, notifikasi email "menunggu persetujuan", konektor Mac (DMG + notarisasi), asisten setup versi checklist (tanpa AI), A03 (admin kantor).

4. **Fase 2: video dan posting (4–6 minggu)**
   - must: render di PC (Remotion), suara ElevenLabs, cover kecil, posting terjadwal lewat Repliz, jam posting per channel.
   - should: galeri template + editor S19/S20 dengan `@remotion/player`, Mode Motion + cek frame, progress %, kembali ke manual otomatis, banyak akun per channel, kalender S24, Web Push, **pratinjau low-res sementara** supaya video bisa disetujui dari HP.
   - Tables: `video_templates`, `channel_template_versions`, `social_accounts`, `channel_accounts`, `push_subscriptions`.

5. **Fase 3: CS WhatsApp (2–3 minggu)**: onboarding Meta Tech Provider + Embedded Signup, webhook, run `cs_reply`, S25–S27, broadcast "wake" ke perangkat. could: manusia ambil alih chat.
   - Tables: `business_infos`, `wa_connections`, `cs_conversations`, `cs_messages`.

6. **Fase 4 (4+ minggu)**: konektor VPS (`/install/vps.sh`, systemd), kantor 3D (React Three Fiber), asisten chat dengan alat (S28), slot PC tambahan, landing EN, Gemini, **Sign in with ChatGPT** (setelah OpenAI menyetujui), CS Discord.

7. **Fixes dari `/replica-entrepreneur`**: diisi setelah ulasan user dibaca.

## Risiko terbesar

1. **Konektor di PC user**: friksi instalasi (SmartScreen, antivirus, syarat PC), biaya code signing, dan agent bertools di komputer pribadi (prompt injection). Mitigasi: allowlist alat, sandbox workspace, installer bertanda tangan sejak hari pertama.
2. **Model biaya AI berbeda dari aslinya**: API key = bayar per token, bukan kuota langganan flat. Login ChatGPT bergantung persetujuan OpenAI. Ini risiko positioning, bukan teknis; anggaran + biaya per tugas jadi jawabannya. Isi formulir minat OpenAI sekarang.
3. **Pihak ketiga Fase 2–3**: API publik Repliz hanya terlihat dari sumber pihak ketiga (`api.repliz.com`, Basic Auth, `POST /public/schedule`), verifikasi ke Repliz dulu; Remotion butuh Company License untuk tim > 3 orang dan paket Automators ($100/bulan minimum) untuk render otomatis; WhatsApp butuh verifikasi bisnis Meta + status Tech Provider.

## Konfigurasi bisnis

Nilai ini dibaca dari env, tidak ditulis langsung di kode. Untuk sekarang memakai
**data dummy**. Ganti dengan data asli sebelum deploy production; preflight
`/replica-deploy` harus gagal bila masih ada nilai dummy.

| env | nilai sekarang | dipakai di |
| --- | --- | --- |
| `APP_DOMAIN` | `kantoraiku.id` | subdomain kantor, cookie, email |
| `PRICE_LIFETIME_IDR` | `299000` | S01, S03, `createOrder` |
| `MANUAL_BANK_NAME` | `BANK DUMMY` | S05 instruksi transfer |
| `MANUAL_BANK_ACCOUNT` | `0000000000` | S05 |
| `MANUAL_BANK_HOLDER` | `NAMA PEMILIK (DUMMY)` | S05 |
| `ADMIN_WHATSAPP` | `6280000000000` | S05 tombol "Konfirmasi via WhatsApp", tombol WA di landing |
| `MANUAL_PAYMENT_HOURS` | `72` | batas pesanan transfer manual |
| `SUPPORT_EMAIL` | `support@kantoraiku.id` (kotak surat belum ada) | footer, S09 legal |
| `LEGAL_ENTITY` | kosong (dokumen legal tampil sebagai draf) | S09 legal: nama pemilik atau badan usaha |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION` | nilai dev acak, `v21.0` | webhook dan kirim pesan Cloud API (app Meta milik Kantoraiku) |

## Ditunda

- **Akun Midtrans**: belum dibuat. Vertical slice dan rilis awal hanya transfer manual.
- **Formulir Sign in with ChatGPT (OpenAI)**: belum diisi. OpenAI hanya lewat API key.
- **Repliz**: konfirmasi API resmi dan paket yang dibutuhkan sebelum Fase 2.

## Sumber

- Aturan login claude.ai di produk pihak ketiga: https://code.claude.com/docs/en/agent-sdk/overview
- Sign in with ChatGPT, kuota paket di aplikasi pihak ketiga: https://developers.openai.com/siwc/quickstart , https://developers.openai.com/siwc/token-sharing-open-source
- Next.js 16 `proxy.ts` (pengganti middleware): dokumentasi Next.js v16.2 via Context7
- Claude Agent SDK `query()`, `allowedTools`, `settingSources`, `total_cost_usd`: dokumentasi Agent SDK via Context7
- Repliz API (pihak ketiga, belum resmi): https://clawhub.ai/skills/repliz
- Lisensi Remotion: https://www.remotion.dev/docs/license
