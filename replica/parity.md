# Parity: Kantoraiku vs Kantorin

Tanggal: 2026-11-14  Build: 7fe92d5 (branch `test/e2e`)
Sumber: `replica/features.csv`, screenshot publik di `replica/screens/`, klon di `replica/clone-screens/`.
Dihitung dengan `parity.py` dan `imgdiff.py` dari skill replica-diff.

## Angka

| | skor | arti |
| --- | --- | --- |
| **Keseluruhan** | **41,1 / 100** | 80% fitur + 20% layout |
| **Fitur** | **44,3** | 75 fitur dihitung; must selesai **19 dari 44** |
| Layout | 28,4 | hanya 2 layar yang bisa dibandingkan |
| Bug S1 terbuka | 0 | lihat `replica/bugs.md` |

**Putusan: belum layak rilis.** Masih ada 25 fitur must yang belum selesai (16 belum ada, 9 sebagian).
Tidak ada bug S1 yang terbuka.

Bobot: must 3, should 2, could 1; "sebagian" dihitung setengah. Baris `skip` (aset dan copy milik
Kantorin, login langganan Claude, WhatsApp Web tidak resmi) dan fitur tambahan Kantoraiku sendiri
(transfer manual, panel admin) tidak ikut dihitung.

## Per area (terlemah dulu)

| area | skor | keterangan |
| --- | --- | --- |
| video | 0 | belum dibangun sama sekali (10 fitur, 3 must) |
| publishing | 0 | Repliz + jam posting (2 must) |
| cs | 0 | CS WhatsApp (3 must) |
| marketing | 0 | landing + halaman legal (2 must) |
| skills | 0 | pustaka skill (1 must) |
| assistant | 25 | agent asisten bawaan ada, chat belum |
| agents | 41,7 | otak Claude dan pasang skill belum; OpenAI sebagian |
| purchase | 45 | Midtrans dan email pesanan menunggu akun |
| connector | 47,4 | CLI dev; installer, Mac, VPS belum |
| security | 50 | kunci pihak ketiga terenkripsi belum ada (belum ada integrasinya) |
| content | 63,9 | riset dan naskah teruji dengan otak simulasi |
| approvals | 80 | notifikasi HP belum |
| auth | 83,3 | subdomain per kantor belum (dev memakai `/o/slug`) |
| tasks | 92,3 | UI anggaran untuk mode hemat belum |
| office | 92,9 | denah 2D, bukan 3D |

Inti produk (kantor, agent, tugas berantai, riset → naskah → persetujuan dari HP) sudah setara.
Yang kosong adalah separuh kedua alur: **video → terbit**, plus **CS WhatsApp** dan **halaman jualan**.

## Layout

Layout dibandingkan tanpa warna (peta tepi, grid). Screenshot klon diambil di lebar yang sama dengan
screenshot asli (1024px). Diff image disimpan lokal di `replica/diffs/`; tidak di-commit karena berisi
gambar situs asli.

| layar | asli | klon | skor | arti |
| --- | --- | --- | --- | --- |
| S03 beli | P02 | `S03-beli-desktop.png` | 35,3 | berbeda |
| S06 masuk | P01 | `S06-masuk-desktop.png` | 21,6 | berbeda |

- **S03 beli:** susunannya sama (form di kiri, kartu harga di kanan, header dengan Masuk). Skornya rendah
  karena kepadatannya beda: teks dan input klon lebih besar, form tidak dibungkus kartu, dan ada pilihan
  "Cara bayar" tambahan (transfer manual atau Midtrans). **Pertahankan.** Ini bukan kekurangan fitur.
  Kalau mau lebih rapat di desktop, cukup ubah token ukuran input, tidak perlu meniru.
- **S06 masuk:** asli punya satu kartu (email saja → link kantor). Klon punya dua jalur: alamat kantor +
  password langsung, atau link lewat email. **Pertahankan.** Jalur alamat kantor menghemat satu email
  dan satu klik.
- **Tidak bisa dibandingkan:** dashboard (S10–S35) ada di balik login Kantorin, dan sesuai keputusan
  awal kita hanya memakai sumber publik. Landing (S01) belum dibangun di klon. Skor layout 28,4 hanya
  mewakili 2 layar publik, jadi jangan dibaca sebagai skor seluruh aplikasi.

## Perilaku per flow

Jumlah klik asli diambil dari `recon.md` (perkiraan dari sumber publik).

| flow | asli | klon | sikap |
| --- | --- | --- | --- |
| F01 beli | 4 isian → bayar lewat payment gateway → kantor dibuat otomatis, kode setup di halaman pesanan, email akses | 4 isian → Buat pesanan → transfer manual + bukti via WA → admin Tandai lunas → pembeli atur password → kantor | **perbaiki:** Midtrans + webhook (kantor otomatis) + email pesanan via Resend. Transfer manual tetap sebagai pilihan kedua |
| F01 kode setup | ditampilkan di halaman pesanan | dibuat di dashboard (S29), sekali pakai, 1 jam | **pertahankan:** halaman pesanan bisa diakses siapa pun yang punya link; kode di dashboard lebih aman |
| F02 setup pertama | dipandu chat Pandu, installer Windows/Mac | dashboard → Buat kode setup → `node … pair` di terminal | **perbaiki:** installer Windows dan chat asisten (should) |
| F03 naskah (inti) | 2 klik per naskah dari notifikasi (buka, setujui) | 3 klik: Persetujuan → item → Setujui; bar persetujuan menempel di HP | **perbaiki:** notifikasi web push yang langsung membuka naskah (bisa jadi 2 klik) |
| F03 video | render di PC, progress %, approval video, terbit lewat Repliz | belum ada; alur berhenti di "Naskah disetujui" | **bangun** (prioritas 4–5 di bawah) |
| F03 PC mati | tugas menunggu | tugas menunggu + banner "PC kamu offline"; run kembali antre bila PC mati di tengah jalan (lease 15 menit) | setara |
| F04 revisi/tolak | catatan revisi, penulis mengulang | sama; catatan wajib, nomor revisi + riwayat catatan terlihat | setara |
| F05 otomatis | 1 klik; kembali ke manual bila render/posting gagal 2x | 1 klik (segmented Manual/Otomatis) | auto-kembali menunggu video + publishing |
| F06 agent | ~6 klik + isian (termasuk skill dan jadwal) | 3 klik + isian (nama, jabatan, job desk, otak, model); jadwal ada di Tugas | lebih sedikit klik; **perbaiki:** pilih skill di form agent |
| F07 tugas berantai | pemicu "setelah agent lain selesai" | sama; rantai melingkar ditolak database | setara |
| F11 masuk | email → link kantor → password | alamat kantor → password (tanpa email), atau link email yang langsung masuk | **lebih baik:** satu langkah lebih pendek |
| Galat | tidak diketahui | pesan Indonesia per kolom, isian tidak hilang, toast saat offline, rate limit login/pesanan | belum bisa dibandingkan |
| Email | detail akses setelah beli | hanya email auth (link masuk, reset password); email pesanan belum | **perbaiki** bersama Midtrans/Resend |

## Yang belum ada, urut build

Must yang belum ada (16): otak Claude, pasang skill, pustaka skill, CS WhatsApp (3), landing, halaman
legal, posting terjadwal Repliz, jam posting, payment gateway, email akses, kunci Repliz/ElevenLabs
terenkripsi, render video di PC, narasi ElevenLabs, video tetap di PC.

Must yang sebagian (9): otak OpenAI (belum dicoba dengan kunci asli), subdomain per kantor, cek status
login AI, konektor Windows (CLI dev), agent penulis dan periset (simulasi), ubah channel, kode setup di
halaman pesanan (sengaja dipindah), kantor dibuat otomatis (menunggu webhook).

Daftar lengkap dari `parity.py` ada di lampiran.

## Lima hal berikutnya

1. **Landing page + halaman legal (S01, S&K, privasi, refund).** 2 must, tanpa ketergantungan luar, dan
   wajib ada sebelum bisa dijual. Copy ditulis sendiri.
2. **Otak Claude (API key) + uji OpenAI dengan kunci asli.** Otak `claude` di konektor lewat Anthropic
   API, setara `brains/openai.ts`. Ini menutup 1 must penuh, dan 3 must yang sebagian (OpenAI, periset,
   penulis) bisa jadi penuh setelah dicoba dengan kunci Anda.
3. **Pustaka skill + pasang skill ke agent (S15, S14).** 2 must, murni kode, dan memakai pola yang
   sudah ada (agent, tugas).
4. **Video di PC: narasi ElevenLabs + footage + render, file tetap di PC, kunci terenkripsi di
   browser.** 4 must, area terbesar yang masih 0. Butuh kunci ElevenLabs milik Anda.
5. **Publishing: Repliz + jam posting per channel.** 2 must. Setelah ini alur inti jalan dari riset
   sampai terbit, dan mode otomatis bisa kembali ke manual sendiri saat gagal.

Sesudah itu: CS WhatsApp (3 must, lewat WhatsApp Cloud API; verifikasi Meta Business butuh waktu, jadi
mulai urus dari sekarang), lalu Midtrans + email pesanan (menunggu akun merchant dan Resend), subdomain,
dan installer Windows.

## Yang sudah lebih baik dari asli

- Masuk dengan alamat kantor + password tanpa harus menunggu email (F11).
- Kode setup tidak pernah tampil di halaman publik (F01/F02).
- Rantai tugas melingkar ditolak di database; run yang terputus kembali antre sendiri (F07, F03).
- Transfer manual sebagai cadangan pembayaran, dengan panel admin (A01–A02).
- 56 uji end-to-end, termasuk isolasi antar kantor dan aksesibilitas.

Peluang dari `features.csv` yang belum dibangun: anggaran AI bulanan per tugas, pratinjau video
resolusi rendah untuk approval dari HP, dan ambil alih chat CS oleh manusia. Ini bahan untuk
`/replica-entrepreneur`.

---

## Lampiran: keluaran parity.py

### Parity: 41.1 / 100

features 44.3  (75 counted, must-haves 19 of 44 done)
layout   28.4  (2 screens compared)

Not shippable yet: 25 must-have features are not done.

### By area, weakest first
- skills                         0.0  (1 features)
- video                          0.0  (10 features)
- publishing                     0.0  (4 features)
- cs                             0.0  (4 features)
- marketing                      0.0  (4 features)
- assistant                     25.0  (2 features)
- agents                        41.7  (8 features)
- purchase                      45.0  (8 features)
- connector                     47.4  (8 features)
- security                      50.0  (2 features)
- content                       63.9  (7 features)
- approvals                     80.0  (4 features)
- auth                          83.3  (3 features)
- tasks                         92.3  (5 features)
- office                        92.9  (5 features)

### Missing, in build order
- [must] agents: Otak AI per agent: Claude, no  (butuh API key (BYOK) atau persetujuan Anthropic untuk login langganan)
- [must] agents: Pasang skill ke agent, no
- [must] cs: Baca percakapan CS di dashboard, no  (S25 S26)
- [must] cs: CS WhatsApp membalas pelanggan otomatis, no  (pakai WhatsApp Cloud API resmi)
- [must] cs: Info bisnis sebagai sumber jawaban CS, no  (S27)
- [must] marketing: Halaman legal: S&K privasi refund, no  (tulis sendiri; jangan salin)
- [must] marketing: Landing page dengan harga dan FAQ, no  (S01)
- [must] publishing: Jam posting per channel, no
- [must] publishing: Posting terjadwal lewat Repliz, no  (FB IG Threads YouTube X TikTok)
- [must] purchase: Bayar sekali untuk akses lifetime lewat payment gateway, no  (Midtrans Rp299.000; ditunda sampai akun merchant dibuat)
- [must] purchase: Email berisi detail akses kantor, no  (email auth sudah jalan; email transaksional pesanan menunggu Resend + domain)
- [must] security: Kunci Repliz dan ElevenLabs dienkripsi di browser untuk PC, no  (kebijakan privasi)
- [must] skills: Pustaka skill: buat dan ubah skill, no  (S15)
- [must] video: Render video di PC: suara narasi + footage, no
- [must] video: Suara narasi lewat ElevenLabs, no  (kunci milik user)
- [must] video: Video tetap di PC; server hanya simpan cover kecil, no  (kebijakan privasi)
- [must] agents: Otak AI OpenAI (lewat Codex) dengan API key milik user, partial  (Responses API + web_search + structured output; belum diuji dengan API key asli)
- [must] auth: Subdomain per kantor ({slug}.domain), partial  (dev memakai /o/{slug}; rewrite subdomain (proxy.ts) belum)
- [must] connector: Cek status login AI di PC tanpa membaca token, partial  (status kunci per otak dilaporkan konektor)
- [must] connector: Konektor PC Windows: instal dan pairing dengan kode setup, partial  (CLI dev (pnpm) dengan pairing kode sekali pakai; installer Electron menyusul)
- [must] content: Agent penulis: naskah lengkap dengan rencana visual, partial  (simulasi teruji; OpenAI belum diuji dengan key asli)
- [must] content: Agent periset: cari topik ramai beserta sumbernya, partial  (simulasi teruji; OpenAI web_search belum diuji dengan key asli)
- [must] content: Channel konten: buat dan ubah, partial  (buat + ganti mode; ubah nama/niche belum)
- [must] purchase: Halaman pesanan menampilkan alamat kantor dan kode setup, partial  (S05 menampilkan alamat + atur password; kode setup sengaja dibuat di dashboard (lebih aman))
- [must] purchase: Kantor dibuat otomatis begitu pembayaran masuk (webhook), partial  (dibuat saat admin menandai lunas; webhook Midtrans menyusul)
- [should] approvals: Setujui dari HP lewat notifikasi, no  (mekanisme notifikasi asli tidak diketahui)
- [should] assistant: Chat asisten membuat agent skill tugas dan channel, no  (S28)
- [should] connector: Auto-update konektor, no
- [should] connector: Konektor Mac, no  (macOS 15+)
- [should] connector: Konektor VPS: agent jalan 24 jam kecuali render video, no  (S35)
- [should] content: Otomatis kembali ke manual setelah render gagal 2x atau posting gagal, no
- [should] publishing: Banyak akun per platform; satu channel ke banyak akun, no  (FAQ)
- [should] publishing: Kalender jadwal terbit, no  (S24)
- [should] video: Cari sumber footage, no  (lisensi footage tanggung jawab user)
- [should] video: Galeri template video, no  (buat template sendiri; 57 template asli tidak diambil)
- [should] video: Mode Motion: video disusun dari kode lalu frame dicek, no
- [should] video: Pratinjau template live di browser, no
- [should] video: Progress render dalam persen, no
- [should] video: Template per channel: caption tampilan suara pembuka penutup, no  (S20)
- [should] assistant: Agent asisten bawaan untuk setup (Pandu), partial  (agent bawaan dibuat saat provisioning; chat belum)
- [should] office: Kantor 3D dengan agent di ruangannya, partial  (denah 2D (meja kerja))
- [should] tasks: Prioritas tugas dan mode hemat saat kuota menipis, partial  (prioritas + skip di claim_task_run; UI anggaran belum)
- [could] agents: Campur beberapa otak AI dalam satu kantor, no  (asli masih segera)
- [could] agents: Login ChatGPT (Sign in with ChatGPT) memakai kuota paket user, no  (jalur resmi OpenAI; terkunci sampai OpenAI menyetujui aplikasi berbayar)
- [could] agents: Otak AI Gemini, no  (asli masih segera)
- [could] connector: Asisten memasang VPS lewat chat, no
- [could] cs: CS Discord, no  (asli masih menyusul)
- [could] marketing: Landing bahasa Inggris, no  (S02)
- [could] marketing: Tombol tanya lewat WhatsApp, no
- [could] purchase: Beli slot PC tambahan (sekali bayar), no  (dari S&K pasal 4)
- [could] purchase: Pengajuan refund 7 hari, no  (asli manual lewat WhatsApp/email)
- [could] video: Setiap versi template tersimpan, no

### Left out on purpose (not scored)
- 57 template video asli Kantorin: desain nama dan aset milik Kantorin
- Aset kantor 3D asli (pulau ruangan karakter): aset milik Kantorin; buat atau beli sendiri
- Login langganan Claude (claude.ai) di produk tanpa persetujuan Anthropic: dilarang dokumentasi Agent SDK; pakai API key atau minta persetujuan
- Otomatisasi WhatsApp Web tidak resmi: melanggar ketentuan WhatsApp; pakai Cloud API
- Kerja sama Lynk.id / Repliz / ElevenLabs: integrasi lewat API publik dengan akun sendiri
- Nama persona dan copy Kantorin (Pandu Rina Maya Putri): diganti di /replica-brand

### Yours, not in the original (not scored)
- Pembayaran transfer manual dengan bukti dikirim lewat WhatsApp
- Panel admin: daftar pesanan dan konfirmasi pembayaran manual
- Panel admin: daftar kantor
- Anggaran AI bulanan dan biaya per tugas
- Pratinjau video resolusi rendah sementara untuk approval dari HP
- Ambil alih chat CS oleh manusia

### Screens
- replica/clone-screens/S06-masuk-desktop.png  21.6
- replica/clone-screens/S03-beli-desktop.png  35.3
