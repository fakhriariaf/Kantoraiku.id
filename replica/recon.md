# Recon map: Kantorin (web dashboard + konektor desktop Windows/Mac + konektor VPS)

Scope: seluruh produk. Kantor AI berisi agent yang kamu atur sendiri (nama, jabatan,
skill, jadwal), pipeline konten dari riset sampai posting video, CS WhatsApp,
dashboard dengan kantor 3D, konektor PC dan konektor VPS.
For: produk milik sendiri (working name: Kantoraiku) yang dijual ke kreator dan UMKM
Indonesia, sama seperti Kantorin.
Date: 2026-11-14

Metode: sumber publik saja. User tidak punya akun Kantorin, jadi semua layar
dashboard (S10 ke atas) **di-infer** dari mockup di landing page, FAQ, dan halaman
legal. Tidak ada bundle JS, network call, atau konektor yang dibaca. S&K Kantorin
pasal 5 melarang merekayasa balik server dan konektor, jadi itu memang di luar batas.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site (landing) | https://kantorin.id/ | sumber utama: agent, alur 5 langkah, template, CS, cara jalan, harga, FAQ (10 tanya-jawab) |
| 2 | landing EN | https://kantorin.id/en | versi Inggris; tidak dibaca terpisah |
| 3 | halaman beli | https://kantorin.id/beli | form pesanan: nama, email, WA, alamat kantor `{slug}.kantorin.id` |
| 4 | halaman masuk | https://kantorin.id/masuk | login via link email, lalu password kantor |
| 5 | lupa password | https://kantorin.id/lupa-password | hanya link; tidak dibuka |
| 6 | kontak | https://kantorin.id/kontak | hanya link; kontak juga ada di footer |
| 7 | syarat & ketentuan | https://kantorin.id/syarat-ketentuan | berlaku 11 Nov 2026: arsitektur dashboard + konektor, slot PC tambahan, larangan reverse engineering |
| 8 | kebijakan privasi | https://kantorin.id/kebijakan-privasi | **bukti terbaik untuk data model**: data apa disimpan di server vs di PC |
| 9 | kebijakan refund | https://kantorin.id/kebijakan-refund | aturan refund 7 hari, syarat PC minimum |
| 10 | pembayaran | Lynk.id (eksternal) | tidak dibuka; kantor dibuat otomatis begitu pembayaran masuk |
| 11 | help center / docs | tidak ada | tidak ditemukan |
| 12 | changelog | tidak ada | produk sangat baru (legal berlaku 3 hari lalu) |
| 13 | app store listing | tidak ada | konektor didistribusikan dari dashboard, bukan store |
| 14 | video walkthrough publik | tidak ada | pencarian web tidak menemukan review/tutorial |
| 15 | public API docs | tidak ada | |
| 16 | dokumentasi pihak ketiga | https://code.claude.com/docs/en/agent-sdk/overview | aturan Anthropic soal login claude.ai di produk pihak ketiga (lihat Out of scope) |

Screenshot referensi: `replica/screens/` (L01–L07 landing, P01 masuk, P02 beli, D01–D14 dashboard dari akun sendiri).
Hanya referensi, tidak pernah masuk ke clone.

## Core loop

Agent AI yang kamu beri nama, jabatan, skill dan jadwal menjalankan tugas di PC
(atau VPS) kamu: riset, naskah, video, posting ke sosmed, dan membalas WhatsApp
pelanggan; kamu tinggal **Setujui / Revisi / Tolak** dari dashboard atau HP.

## Screens

Kolom "states seen": **dilihat** = terlihat langsung di sumber publik;
**inferred** = disimpulkan dari mockup/teks, belum pernah dilihat.

### Publik (kantorin.id)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Landing | `/` | jualan: pitch, alur, template, CS, cara jalan, harga, FAQ | header sticky (logo, Masuk, EN, CTA), hero + gambar kantor 3D + toast aktivitas, kartu agent, daftar otak AI (tersedia/segera), pipeline 5 langkah + toggle Manual/Otomatis, dinding template video autoplay + "Jeda gerakan", mockup chat WA, diagram PC–Dashboard–VPS, kartu kebutuhan, kartu harga, FAQ accordion, tombol WA melayang, footer | dilihat: desktop 800px. inferred: mobile |
| S02 | Landing EN | `/en` | versi Inggris | sama dengan S01 | dilihat: link saja |
| S03 | Beli | `/beli` | form pesanan sebelum bayar | input nama, email, WA (placeholder 08xx), input alamat dengan suffix `.kantorin.id` + helper "3–30 huruf kecil, angka, tanda hubung, tidak bisa diganti", tombol "Lanjut ke pembayaran", kartu ringkasan paket | dilihat: empty. inferred: error format slug, slug sudah dipakai, submit loading |
| S04 | Pembayaran | redirect ke Lynk.id | bayar Rp299.000 | halaman pihak ketiga | di luar app |
| S05 | Halaman pesanan | kembali dari pembayaran | tampilkan alamat kantor + kode setup (juga dikirim email) | status bayar, alamat kantor, kode setup, tombol buka kantor | inferred: menunggu bayar, lunas, gagal/kedaluwarsa |
| S06 | Masuk | `/masuk` | minta link kantor lewat email | input email, tombol "Kirim link kantor", link "Atur ulang password", link "Mulai di sini" | dilihat: empty. inferred: terkirim, email tidak dikenal |
| S07 | Lupa password | `/lupa-password` | reset password kantor | input email | inferred: empty, terkirim, set password baru |
| S08 | Kontak | `/kontak` | kontak support | email, WA, alamat | dilihat: footer |
| S09 | Legal | `/syarat-ketentuan`, `/kebijakan-privasi`, `/kebijakan-refund` | dokumen legal | artikel, label "LEGAL", tanggal berlaku | dilihat: filled |

### Dashboard (`{slug}.kantorin.id`, semua inferred)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S10 | Login kantor | `{slug}.kantorin.id` tanpa sesi | masuk dengan password kantor | input password, link lupa password | inferred: empty, salah password |
| S11 | Kantor 3D (beranda) | default setelah login | melihat agent bekerja di ruangan masing-masing | scene 3D pulau dengan ruangan, label nama di atas agent, toast/feed aktivitas, nama kantor ("Studio Budi"), status PC | inferred: PC online, PC offline, agent bekerja/idle, mobile |
| S12 | Feed aktivitas | panel di S11 | riwayat kejadian kantor | item: avatar inisial, "Maya mengajukan naskah untuk disetujui", peran · waktu relatif | inferred: empty, filled |
| S13 | Daftar agent | menu Agent | lihat semua karyawan AI | kartu agent (avatar inisial berwarna, nama, jabatan, pill status Bekerja/Menunggu kamu/Siap, chip SKILL, JADWAL), kartu putus-putus "+ Agent berikutnya, kamu yang buat", Pandu bertanda "bawaan" | inferred: hanya Pandu, filled |
| S14 | Editor agent | klik kartu / "+" | buat atau ubah agent | nama, jabatan, job desk (textarea), pilih skill, jadwal, pilih otak AI per agent | inferred: baru, edit, validasi |
| S15 | Skill | menu Skill | pustaka skill yang dipasang ke agent | daftar skill, editor instruksi | inferred: empty, filled |
| S16 | Tugas & jadwal | menu / tab di agent | atur kapan agent bekerja | pemicu: jam ("Setiap hari 06.00"), setelah agent lain selesai, manual, kapan saja (CS); prioritas untuk mode hemat | inferred: aktif, nonaktif, gagal, dilewati (mode hemat) |
| S17 | Daftar channel | menu Channel | channel konten (satu identitas/niche posting) | kartu channel, badge mode | inferred: empty, filled |
| S18 | Pengaturan channel | klik channel | mode, akun tujuan, jam posting, bahasa konten, mode video | segmented Manual/Otomatis, chip platform, picker jam posting, pilih akun Repliz | inferred: manual, otomatis, auto-kembali ke manual |
| S19 | Galeri template | dari channel | pilih template video Mode Motion | grid video 9:16 autoplay, nama template, jumlah template | inferred: loading, filled |
| S20 | Editor template channel | dari S18/S19 | atur caption, tampilan, suara, pembuka, penutup + pratinjau live di browser | panel pengaturan, player pratinjau, riwayat versi | inferred: draft, tersimpan, versi lama |
| S21 | Persetujuan (inbox) | menu / notifikasi HP | antrian yang menunggu kamu | item konten, pill "Menunggu kamu", tombol Setujui / Revisi / Tolak | inferred: empty, menunggu, mobile |
| S22 | Detail konten | klik item | baca naskah + rencana visual, sumber riset, cover | teks naskah, statistik "112 kata · 48 detik", daftar sumber, kolom catatan revisi | inferred: naskah, video, revisi, ditolak |
| S23 | Produksi / pipeline | menu Konten | status tiap konten dari riset sampai terbit | stepper 5 langkah, progress render %, status | inferred: riset, naskah, render, gagal, terjadwal, terbit |
| S24 | Jadwal terbit | menu Jadwal | kalender posting | daftar/kalender, chip platform, "Terjadwal 16.00" | inferred: empty, terjadwal, gagal posting |
| S25 | CS WhatsApp: daftar percakapan | menu CS | baca semua chat pelanggan | daftar percakapan, nama/nomor, preview, waktu | inferred: empty, filled |
| S26 | CS WhatsApp: percakapan | klik percakapan | baca isi chat | header agent CS "online", gelembung masuk/keluar, jam | inferred: filled |
| S27 | Info bisnis | menu CS / agent CS | sumber jawaban agent CS | editor teks: produk, cara order, dll. | inferred: empty, filled |
| S28 | Chat Pandu (asisten) | panel/tombol asisten | setup lewat chat: buat agent, skill, tugas, channel, pasang VPS | thread chat, input, langkah yang harus dilakukan user sendiri | inferred: first-run, normal, menunggu aksi user |
| S29 | Perangkat | menu Perangkat | status PC dan VPS, kode setup, slot PC | kartu PC "wajib" (online/offline), kartu VPS "opsional" ("Server belum dipasang"), kode setup, unduh konektor | inferred: belum terpasang, online, offline |
| S30 | Kunci & integrasi | menu Pengaturan | kunci Repliz, ElevenLabs; status login AI | input kunci (dienkripsi di browser, hanya bisa dibuka di PC), status | inferred: kosong, tersimpan, PC belum ada |
| S31 | Pengaturan kantor | menu | password, mode hemat, nama kantor | form | inferred |
| S32 | Notifikasi HP | sistem | "Setujui dari HP" | push / PWA / email (mekanisme tidak diketahui) | inferred |

### Konektor (semua inferred)

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S33 | Konektor PC: instal & pairing | unduh dari S29 | pasang di Windows/Mac, isi kode setup, cek login AI | installer, input kode setup, cek status login | inferred: belum login, terhubung, error |
| S34 | Konektor PC: status | ikon tray / jendela kecil | status jalan, tugas aktif, update | menu tray | inferred: online, sibuk, offline, update |
| S35 | Konektor VPS | dipasang Pandu lewat chat | agent jalan 24 jam (kecuali render video) | headless service | inferred: belum dipasang, online |

## Flows

```
F01 Pengunjung membeli kantor
    S01 -> S03 (4 field) -> S04 bayar -> S05 alamat kantor + kode setup (+ email)
    happy path clicks: 3 klik + 4 field + pembayaran
    edge: slug sudah dipakai, format slug salah, pembayaran gagal/kedaluwarsa,
          bayar ganda (refund selisih), salah ketik email, kantor belum aktif 1x24 jam (refund penuh)

F02 Setup pertama dengan Pandu
    S05/S10 login -> S28 Pandu -> S29 unduh konektor -> S33 pasang + kode setup
    -> cek login AI -> Pandu membuat agent, skill, tugas, channel -> S30 isi kunci Repliz/ElevenLabs
    -> video pertama tayang
    happy path clicks: tidak terukur dari sumber publik (perkiraan 15+ langkah, banyak di luar app)
    edge: PC di bawah syarat minimum, paket Claude tidak mencakup Claude Code, antivirus blok installer,
          kunci salah, user belum punya akun Repliz/ElevenLabs

F03 Satu video, mode manual (CORE LOOP)
    S16 jadwal 06.00 -> Periset jalan (S11/S12 "Rina selesai meriset 3 topik")
    -> Penulis jalan setelah Periset -> S32 notifikasi -> S21 -> S22 baca naskah -> Setujui
    -> render video di PC (S23 progress %) -> S21 approval video -> Setujui
    -> S24 terjadwal 16.00 -> terbit ke TikTok/IG/YT lewat Repliz
    happy path clicks: 4 (buka, setujui naskah, buka, setujui video)
    edge: PC mati saat jadwal (tugas menunggu), kuota AI menipis (mode hemat melewati tugas prioritas rendah),
          render gagal, posting gagal, revisi

F04 Revisi atau tolak
    S21 -> S22 -> Revisi + catatan -> Penulis mengulang -> S21 lagi
    S21 -> S22 -> Tolak -> konten diarsip
    edge: revisi berulang, catatan kosong

F05 Mode otomatis
    S18 toggle Otomatis -> pipeline jalan tanpa S21
    -> kembali ke manual sendiri bila render gagal 2x berturut-turut atau posting gagal (+ notifikasi)
    happy path clicks: 1
    edge: user kembali ke manual di tengah render

F06 Membuat agent baru
    S13 -> "+" -> S14 nama, jabatan, job desk, skill, jadwal, otak AI -> simpan -> muncul di S11
    happy path clicks: ~6 + isian
    edge: nama dobel, tanpa skill, otak AI masih "segera"

F07 Tugas berantai
    S16 -> tugas baru -> pemicu "setelah agent lain selesai" -> pilih tugas sumber -> simpan
    edge: dependensi melingkar, tugas sumber gagal, tugas sumber ditolak user

F08 CS WhatsApp membalas pelanggan
    pelanggan kirim WA -> agent CS baca S27 info bisnis -> balas -> pemilik baca di S25/S26
    happy path clicks (pemilik): 0, membaca opsional
    edge: pertanyaan di luar info bisnis, PC/VPS mati (tidak ada balasan), spam,
          pelanggan minta manusia, gambar/voice note

F09 Memasang VPS
    S28 minta Pandu -> isi akses VPS -> Pandu memasang konektor -> S29 VPS online
    edge: OS VPS tidak didukung, SSH gagal; render video tetap hanya di PC

F10 Atur template video channel
    S18 -> S19 pilih template -> S20 ubah caption/tampilan/suara/pembuka/penutup -> pratinjau live -> simpan versi
    edge: font/aset tidak termuat, kembali ke versi lama

F11 Masuk kembali
    S06 isi email -> email berisi link kantor -> S10 password -> S11
    edge: email tidak terdaftar, lupa password (S07), sesi kedaluwarsa

F12 Tambah slot PC (dari S&K "Slot PC tambahan")
    S29 -> beli slot -> pairing PC kedua (S33)
    edge: slot habis
```

Angka yang harus dikalahkan: F03 = 4 klik per video dalam mode manual, 0 klik dalam mode otomatis.

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (hijau), secondary (putih bergaris), ghost/link, ikon | default, hover, focus, disabled, loading | semua |
| Segmented toggle | 2 opsi | aktif, tidak aktif | S01, S18 |
| Input teks | biasa, dengan suffix (`.kantorin.id`), textarea | empty, focus, error, disabled | S03, S06, S07, S10, S14, S27, S30 |
| Helper / error text | info, error | - | form |
| Avatar inisial | warna per agent (RI, MA, PU, PA) | - | S11–S14, S21, S26 |
| Status pill + dot | Bekerja (hijau), Menunggu kamu (amber), Siap, online, tersedia, segera | - | S13, S21, S26, S29 |
| Chip | skill, platform (TikTok/Instagram/YouTube), tag (bawaan, wajib, opsional) | - | S13, S18, S24, S29 |
| Kartu agent | normal, kartu "+" putus-putus | idle, bekerja, menunggu | S13 |
| Item feed aktivitas / toast | - | baru, lama | S11, S12 |
| Kartu langkah pipeline | Riset, Naskah, Persetujuan, Video, Terbit | belum, jalan, selesai, menunggu, gagal | S23, S01 |
| Grup tombol approval | Setujui / Revisi / Tolak | default, loading, selesai | S21, S22 |
| Progress bar | render % | 0–100, gagal | S23 |
| Kartu template video | video 9:16 autoplay + nama | playing, paused, loading | S19, S01 |
| Gelembung chat | masuk, keluar, dengan jam | - | S26, S28 |
| Kartu perangkat (node) | PC, Dashboard, VPS | online, offline, belum dipasang | S29, S01 |
| Baris otak AI | tersedia, segera | - | S14, S01 |
| Kartu harga | dengan daftar centang | - | S01, S03 |
| Accordion FAQ | - | buka, tutup | S01 |
| Label eyebrow mono | huruf kapital monospace | - | semua heading seksi |
| Tombol WA melayang | - | - | S01, publik |
| Header / nav | publik, dashboard | sticky | semua |
| Modal / sheet | konfirmasi, form | - | inferred di dashboard |
| Toast | sukses, error | - | inferred di dashboard |
| Scene 3D kantor | - | loading, PC offline | S11 |

Catatan visual (untuk replica-design, jangan disalin langsung): font Geist + Geist Mono,
primary hijau, aksen oranye-merah, latar gradien peach hangat, kartu putih dengan border
tipis dan radius besar.

## Inferred data model

```
Order       id, name, email, whatsapp, office_slug, plan (lifetime | pc_slot), amount_idr,
            status (pending | paid | failed | refunded), payment_provider, payment_ref, created_at
            evidence: S03 form, privasi "Data pembelian: nama, email, nomor WhatsApp, paket, nominal, status pembayaran"
            confidence: high

Office      id, slug (3–30, a-z 0-9 -, immutable, unique), display_name ("Studio Budi"),
            owner_email, password_hash, language (id), saver_mode (bool), pc_slots (int), created_at
            evidence: S03 helper text, S06/S07, privasi "alamat kantor, password dalam bentuk hash", S&K slot PC
            confidence: high

SetupCode   id, office_id, code, used_at
            evidence: "kode setup langsung muncul di halaman pesanan"
            confidence: medium (bisa jadi satu per kantor, bisa satu per perangkat)

Device      id, office_id, kind (pc_windows | pc_mac | vps), name, status (online | offline),
            last_seen_at, ai_login_status, public_key (untuk menerima kunci terenkripsi),
            can_render_video (pc only), connector_version
            evidence: privasi "status perangkat yang terhubung", S&K, landing "Cara jalan", "dikunci di browser dan baru bisa dibuka di PC"
            confidence: high (public_key: guess dari cara kerja enkripsi)

Agent       id, office_id, name, initials, color, title (jabatan), job_description, is_builtin (Pandu),
            brain (claude_code | chatgpt | gemini | own_api_key), status (idle | working | waiting_user | ready),
            room (posisi di kantor 3D), created_at
            evidence: S13 kartu agent, privasi "pengaturan agent, job desk", "Otak AI" per agent
            confidence: high (room: guess)

Skill       id, office_id, name, instructions (markdown), created_at
AgentSkill  agent_id, skill_id
            evidence: "Tulis job desk, pasang skill", chip SKILL di kartu agent
            confidence: high (isi skill kemungkinan file SKILL.md untuk Claude Code: guess)

Task        id, office_id, agent_id, channel_id (nullable), name, instructions,
            trigger (schedule | after_task | manual | always_on), cron / time, after_task_id,
            priority (low | normal | high), enabled
            evidence: "Tugas bisa berjalan sesuai jam, setelah agent lain selesai, atau manual", FAQ mode hemat "tugas berprioritas rendah"
            confidence: high

TaskRun     id, task_id, device_id, status (queued | running | succeeded | failed | skipped | waiting_approval),
            started_at, finished_at, summary, error
            evidence: "Pekerjaan menunggu sampai PC menyala lagi", auto-fallback setelah 2 kegagalan
            confidence: medium

Channel     id, office_id, name, content_language, mode (manual | auto), post_times[],
            video_mode (footage | motion), template_id, consecutive_failures, created_at
            evidence: "Setiap channel bisa diganti ke mode otomatis", "Setiap channel punya template video sendiri", "channel berbahasa Inggris"
            confidence: high

SocialAccount id, office_id, platform (facebook | instagram | threads | youtube | x | tiktok),
            handle, repliz_account_ref
ChannelAccount channel_id, social_account_id
            evidence: "satu platform bisa banyak akun, satu channel bisa posting ke beberapa akun"
            confidence: high

Topic       id, channel_id, title, sources (json: url, judul), found_by_agent_id, picked (bool), created_at
            evidence: "Periset mencari topik yang sedang ramai beserta sumbernya", "3 topik ditemukan"
            confidence: medium

Content     id, channel_id, topic_id, script (text), visual_plan (json), word_count, duration_s,
            stage (research | script | script_review | rendering | video_review | scheduled | published | rejected | failed),
            cover_thumb_url (kecil), video_path_on_device (bukan di server), device_id,
            scheduled_at, published_at, published_urls (json)
            evidence: alur 5 langkah, "112 kata · 48 detik", privasi "naskah ... cover kecil", "Video tidak disimpan di server"
            confidence: high

Approval    id, content_id, stage (script | video), decision (approve | revise | reject), note, decided_at
            evidence: "Setujui, Revisi, atau Tolak", privasi "riwayat approval"
            confidence: high

VideoTemplate id, key, name ("Papan Kapur", ...), kind (motion), preview_url
              evidence: dinding 57 template
              confidence: high
ChannelTemplateVersion id, channel_id, video_template_id, caption_style, look, voice_id (ElevenLabs),
              intro, outro, version, created_at
              evidence: "caption, tampilan, suara, pembuka, dan penutup ... setiap versi tersimpan"
              confidence: high

BusinessInfo id, office_id, title, body
            evidence: "membalas memakai info bisnis yang kamu tulis, misalnya produk dan cara order"
            confidence: high

CsConversation id, office_id, agent_id, customer_phone, customer_name, last_message_at
CsMessage      id, conversation_id, direction (in | out), body, sent_at, sent_by_agent (bool)
            evidence: privasi "isi percakapan dengan pelanggan Anda disimpan", mockup chat
            confidence: high

AssistantMessage id, office_id, role (user | assistant), body, created_at
            evidence: privasi "percakapan dengan Asisten"
            confidence: high

ActivityEvent id, office_id, agent_id, verb, object_type, object_id, text, created_at
            evidence: hero toast "Maya mengajukan naskah untuk disetujui", "Rina selesai meriset 3 topik"
            confidence: high

EncryptedSecret id, office_id, device_id, kind (repliz | elevenlabs | ...), ciphertext, created_at
            evidence: privasi "Kunci yang Anda isi lewat dashboard dienkripsi di browser dan hanya dapat dibuka di PC Anda"
            confidence: high (skema enkripsi: guess)

Session / MagicLinkToken / PasswordResetToken  standar
            evidence: S06, S07, privasi "cookie ... menjaga sesi login"
            confidence: medium
```

Relationships: Order 1-1 Office; Office 1-n Device, Agent, Skill, Channel, SocialAccount,
BusinessInfo, CsConversation, AssistantMessage, ActivityEvent, EncryptedSecret;
Agent n-n Skill; Agent 1-n Task; Task 1-n TaskRun; Task 0-1 Task (after_task);
Device 1-n TaskRun; Channel n-n SocialAccount; Channel 1-n Topic, Content, ChannelTemplateVersion;
Content 1-n Approval; CsConversation 1-n CsMessage.

Yang **tidak** disimpan di server (dari kebijakan privasi, perlu dipertahankan di clone):
file video hasil render, login akun AI, kunci Repliz dan ElevenLabs dalam bentuk terbuka.

## Feature matrix

See `features.csv` (87 baris, termasuk keputusan dari `/replica-architect`: transfer manual,
panel admin, OpenAI API key, anggaran AI, pratinjau video). Must: 46, should: 24, could: 11, skip: 6.

## Out of scope (cannot or should not be cloned)

- **Login langganan Claude user di produk kamu.** Inti jualan Kantorin adalah "agent
  memakai langganan Claude kamu" lewat Claude Code di PC user. Dokumentasi Anthropic
  menyatakan: "Anthropic does not allow third party developers to offer claude.ai login
  or rate limits for their products" kecuali sudah disetujui, dan menyarankan API key.
  Clone kamu harus memakai API key (milik user, BYOK) atau mendapat persetujuan Anthropic
  dulu. Juga: produk tidak boleh menamai dirinya "Claude Code" atau meniru tampilannya.
  Ini keputusan untuk `/replica-architect`, dan memengaruhi pitch "tanpa biaya kuota AI".
- **WhatsApp lewat jalur tidak resmi.** Otomatisasi WhatsApp Web (mis. library pihak ketiga)
  melanggar ketentuan WhatsApp dan berisiko nomor diblokir (S&K Kantorin sendiri menyebut
  "penangguhan akun ... WhatsApp"). Clone memakai WhatsApp Business Platform (Cloud API)
  resmi via Meta atau BSP.
- **57 template video Kantorin** (Papan Kapur, Atlas Kertas, dst.): desain, nama, dan
  aset mereka. Clone membuat template sendiri.
- **Gambar dan aset kantor 3D** (pulau, ruangan, karakter): buat atau beli aset sendiri.
- **Nama, persona, dan copy**: "Kantorin", "Pandu", nama agent contoh (Rina, Maya, Putri),
  teks landing. Diganti di `/replica-brand`.
- **Kerja sama pihak ketiga**: Lynk.id (pembayaran), Repliz (posting), ElevenLabs (suara).
  Clone mengintegrasikan lewat API publik mereka dengan akun kamu sendiri; Lynk.id bisa
  diganti Midtrans/Xendit.
- **Konten dan footage**: lisensi footage/musik adalah tanggung jawab user (S&K pasal 6).

## Size

Screens 35 (9 publik, 23 dashboard, 3 konektor), flows 12, entities 22.

Hard parts:
1. **Konektor desktop Windows + Mac** (installer bertanda tangan, auto-update, pairing,
   antrean tugas, jalan di background) plus varian VPS.
2. **Orkestrasi agent**: menjalankan Claude Agent SDK / CLI headless per tugas, jadwal +
   dependensi + prioritas + mode hemat, kirim hasil ke dashboard secara realtime.
3. **Render video lokal**: TTS ElevenLabs + footage, atau Mode Motion (video dari kode,
   mis. Remotion) dengan cek frame; 57 template dan pratinjau live di browser.
4. **CS WhatsApp resmi** (Cloud API, webhook, verifikasi bisnis Meta).
5. **Kantor 3D** realtime yang ringan di HP.
6. Enkripsi kunci di browser ke public key perangkat; multi-tenant subdomain;
   posting terjadwal via Repliz; isu login Claude (lihat Out of scope).

Size: **XL, rescope.** Saran urutan:
- Fase 1 (M): beli -> kantor -> pairing konektor PC -> agent + skill + tugas terjadwal ->
  hasil teks (riset + naskah) -> approval di dashboard. Kantor 3D diganti tampilan 2D dulu.
- Fase 2 (M): render video di PC + template + posting via Repliz + mode otomatis.
- Fase 3 (S–M): CS WhatsApp resmi + info bisnis.
- Fase 4 (M): konektor VPS, kantor 3D, asisten setup (Pandu), slot PC tambahan.

## Dashboard asli dilihat langsung (akun sendiri, 15 Nov 2026)

User sekarang punya akun Kantorin (`{slug}.kantorin.id`) dan mengambil 14 screenshot
dashboard sebagai pemakai biasa: `replica/screens/D01`–`D14` (lokal, tidak di-commit).
S&K Kantorin (dicek 15 Nov 2026) tidak melarang memakai akun untuk membandingkan
produk; yang dilarang pasal 5 hanya membobol, membebani, atau merekayasa balik server
dan konektor. Jadi tidak ada bundle, network call, atau konektor yang dibaca. Bagian ini
**mengoreksi** layar S11–S31 yang sebelumnya cuma di-infer.

### Struktur navigasi (dilihat)

Nav atas cuma 6 menu: **Kantor, Konten, Jadwal, Channel, Agent, Pengaturan**, ditambah
nama kantor di samping logo, tombol asisten global dengan pintasan keyboard (Ctrl J)
yang membuka chat Pandu dari halaman mana pun, avatar pemilik, dan tombol bantuan (?)
melayang. Persetujuan, Skill, Tugas, Perangkat, Kunci, dan CS **tidak** jadi menu
sendiri: masing-masing ada di tab Konten, tab Agent, atau sub-bagian Pengaturan.

### Layar (dilihat)

| ID | screen | yang terlihat | catatan untuk klon |
| --- | --- | --- | --- |
| D01 (S11) | Kantor | pulau 3D isometrik dengan ruangan, label nama agent di atas tiap agent (pemilik juga punya avatar). Kartu melayang: **Perlu keputusan kamu** (kosong + tombol ke Konten), **Hari ini** per channel (dropdown channel; video terbit, siap diunggah, jadwal posting tersisa), **Sedang bekerja** (agent aktif atau "N agent sedang istirahat" + lihat aktivitas), **Kuota** (5 jam + mingguan, persen, waktu reset, tombol mode hemat). Pil bawah: PC online, kuota %. Kontrol kamera: putar, layar penuh, reset. | klon: denah 2D + feed. Kurang: kartu Hari ini, Sedang bekerja, Kuota/anggaran, kontrol kamera |
| D02 (S21+S23) | Konten | judul + ringkasan ("tidak ada yang menunggu"), cari judul, tombol aktivitas tim. Tab berhitungan: Perlu keputusan, Gagal, Sedang dikerjakan, Siap & terjadwal, Terbit, Laporan, Lainnya (menu). Chip filter per channel dengan jumlah + ikon channel. Tata letak daftar kiri + panel detail kanan; kosong per tab punya teks sendiri. | klon: halaman Persetujuan terpisah, detail konten di halaman sendiri, tidak ada daftar konten per status |
| D03 (S24) | Jadwal | grid 7 hari × channel (navigasi minggu, tombol Hari ini). Header kolom: hari, jumlah posting/slot kosong. Baris channel: nama, format, jam, platform, isi antrean; bisa dilipat. Kartu posting: thumbnail, jam, status, judul. Slot kosong bisa diklik untuk diisi dari antrean. Tab sumber: Semua / dari aplikasi / dari Repliz (posting yang dibuat langsung di Repliz ikut tampil), status sinkron + tombol muat ulang, pilih banyak, filter channel / platform / status, legenda warna status. | klon: daftar per hari, tanpa grid, tanpa sinkron Repliz |
| D04 (S17) | Channel | tab Channel / Template (berhitungan), tombol channel baru. Tabel dikelompokkan per grup ("Shorts Indonesia"): nama + badge bahasa + handle akun, posting berikutnya, jam posting, jam riset, mode (Manual/Otomatis), video per hari. Klik baris = ubah jadwal di tempat. | klon: kartu channel. Kurang: grup, jam riset, target per hari, tab template, ubah di tempat |
| D05 (S13) | Agent | tab Agent / Ruangan / Skill. Tombol Impor, Buat dengan asisten, Agent baru. Tabel dikelompokkan per channel (agent bisa dipakai banyak channel: badge "+1 channel"), lalu per ruangan (ruang pemilik, ruangan lain). Kolom: avatar inisial, nama + job desk singkat, status, otak AI (nama model), jadwal ("jalan 2 jam lagi" / tidak terjadwal). Agent peran Manager; agent hasil impor berstatus "baru diimpor, cek dulu". | klon: kartu agent, Skill dan Tugas menu sendiri. Kurang: grup per channel/ruangan, impor/ekspor agent, kolom model + jadwal berikutnya, peran Manager |
| D06 (S31) | Pengaturan › Kantor | identitas (nama kantor, pemilik, zona waktu). Toggle acara ulang tahun. **Acara kantor** (jam, hari, aktif, ubah): stand-up pagi, rapat mingguan, makan bersama hari Jumat, semuanya animasi di kantor 3D. **Briefing harian** oleh agent Manager (ringkasan 24 jam: hasil, persetujuan menunggu, run gagal, kuota). **Batas revisi pemilik** 1–10. **Nama samaran**: nama asli diganti samaran di dashboard; channel tertentu diburamkan saat kantor direkam; toggle tampilkan nama asli per tab. | klon: belum ada |
| D07 (S30) | Pengaturan › Repliz | penjelasan + panduan, status akun sosmed yang tersambung (daftar handle), Access Key dan Secret Key terpisah (tersimpan / ganti / hapus). | klon: satu kunci Repliz di menu Kunci; daftar akun tersambung belum ada |
| D08 (S30) | Pengaturan › ElevenLabs | API key (tersimpan / ganti / hapus) + tombol cek kunci. | klon: ada kunci; tombol cek belum |
| D09 (S29) | Pengaturan › PC dan VPS | kartu PC: nama, badge PC utama, online, versi konektor, video yang sedang dikerjakan. Toggle **pakai untuk video**, pilihan **jumlah render bersamaan**, tombol installer dan cabut. Hitungan slot PC terpakai + **Ganti PC** (PC lama dicabut saat PC baru tersambung). VPS: status, pasang lewat asisten, atau tampilkan perintah pasang. | klon: halaman Perangkat (pairing, status, cabut). Kurang: toggle video per PC, render bersamaan, ganti PC, VPS |
| D10 | Pengaturan › Layanan luar | **baru**: daftar alamat cek kesehatan layanan di luar Kantorin (mis. bot di server lain), dicek berkala, pemilik dikabari saat mati/pulih; status juga di beranda. | klon: belum ada |
| D11 (S25–S27) | Pengaturan › CS WhatsApp | peringatan besar (asli memakai WhatsApp Web lewat perangkat tertaut, bukan API resmi: **tidak ditiru**, lihat Out of scope). Nomor + sambungkan, buka percakapan. Pengaturan: CS aktif, sapaan (kamu/kak), **balasan singkat saat PC/VPS mati** (maks sekali per pelanggan per jam), **CS diam N jam setelah pemilik membalas sendiri**, **batas umur chat** yang dijawab otomatis, **FAQ** (maks 100 tanya-jawab) + profil bisnis. | klon: info bisnis + ambil alih. Kurang: knob di atas + FAQ terstruktur |
| D12 | Pengaturan › Akun | keluar (browser ini), ganti password (lama, baru, ulangi), tautan lupa password. | klon: cek; ganti password di dalam dashboard belum ada |
| D13 | Pengaturan › Kuota | pemakaian kuota langganan Claude (5 jam + mingguan, dari laporan Claude Code tiap run). Toggle **mode hemat sekarang**, **ambang otomatis** (nyala di X%, cabut di Y%). | klon: prioritas + skip di antrean, tanpa UI. Login langganan Claude tetap skip; versi kita: anggaran biaya API |
| D14 | Pengaturan › Video | model AI editor video (memilih momen footage + mengecek hasil), **render hanya saat laptop dicas**, **batas cache** GB (+ sisa ruang minimal), **bersihkan arsip** setelah N hari, **arsip ke Google Drive** (lewat rclone di PC). | klon: belum ada |

### Koreksi atas inferensi lama

- Agent bawaan asisten disebut Pandu; agent default kanal video: Periset (topik +
  footage), Penulis naskah, Animator (video Motion, memakai model lebih besar), Manager.
- Ada konsep **grup channel** dan **ruangan**; agent bisa dibagi ke beberapa channel.
- Kuota yang dipantau adalah kuota langganan Claude (bukan anggaran rupiah).
- Jadwal membaca balik posting dari Repliz, jadi Repliz adalah sumber jadwal kedua.
