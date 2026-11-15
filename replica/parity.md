# Parity: Kantoraiku vs Kantorin

Tanggal: 2026-11-15  Build: branch `build/jadwal-channel` (Paket B: grid Jadwal 7 hari, tabel Channel berkelompok)
Sumber: `replica/features.csv`, screenshot publik di `replica/screens/`, klon di `replica/clone-screens/`.
Dihitung dengan `parity.py` dan `imgdiff.py` dari skill replica-diff.

## Angka

**Koreksi 15 Nov (sore):** dashboard asli kini dilihat langsung dari akun pemilik (`replica/screens/D01–D14`,
lihat bagian "Dashboard asli dilihat langsung" di `recon.md`). Ternyata ada 33 fitur yang sebelumnya tidak
terlihat dari sumber publik, jadi skor turun. Ini bukan kemunduran: angkanya memang jadi lebih jujur.

| | setelah Paket B | setelah Paket A | dashboard baru dilihat | sebelum dashboard dilihat | 14 Nov | arti |
| --- | --- | --- | --- | --- | --- | --- |
| **Keseluruhan** | **55,2 / 100** | 53,5 | 49,9 | 62,6 | 41,1 | 80% fitur + 20% layout |
| **Fitur** | **62,2** | 60,1 | 55,6 | 71,5 | 44,3 | 108 fitur dihitung (sebelumnya 75) |
| Must selesai | **32 dari 45** | 32 dari 45 | 31 dari 45 | 31 dari 44 | 19 dari 44 | daftar Konten per keadaan (D02) selesai |
| Layout | 27,1 | 27,1 | 27,1 | 27,1 | 28,4 | 3 layar publik; sengaja tidak meniru (lihat di bawah) |
| Bug S1/S2 terbuka | 0 | 0 | 0 | 0 | 0 | lihat `replica/bugs.md` |
| Uji e2e | 127 lolos | 123 lolos | — | 116 lolos | 56 | termasuk 4 tes aplikasi Windows (Electron sungguhan) |

**Putusan: belum layak rilis.** Masih ada 13 must yang belum penuh, dan tidak satu pun tertahan kode:
12 menunggu akun, kunci, atau data dari pemilik, dan 1 sengaja dibuat beda (tabel "Yang menahan" di bawah).

Bobot: must 3, should 2, could 1; "sebagian" dihitung setengah. Baris `skip` (aset, copy, dan persona
Kantorin, login langganan Claude, WhatsApp Web tidak resmi) dan fitur tambahan Kantoraiku sendiri
tidak ikut dihitung.

## Per area (terlemah dulu)

| area | skor | 14 Nov | keterangan |
| --- | --- | --- | --- |
| connector | 60,5 | 47,4 | aplikasi Windows + installer; auto-update belum diuji dengan rilis; Mac dan VPS belum |
| purchase | 47,5 | 45 | Midtrans, webhook, dan email pesanan menunggu akun merchant + Resend |
| video | 52,3 | 0 | render di PC, narasi, gambar AI per adegan atau footage stok; visual per channel; galeri template + caption/pembuka per channel belum |
| marketing | 62,5 | 0 | landing jadi; legal masih draf (butuh identitas pengelola) |
| publishing | 65 | 0 | jam posting + tandai sudah diposting; Repliz menunggu dokumentasi API |
| agents | 72,2 | 41,7 | Claude dan OpenAI belum dicoba dengan kunci asli |
| content | 72,2 | 63,9 | periset/penulis teruji dengan simulasi |
| assistant | 75 | 25 | chat setup terpandu (S28) tanpa AI; otak AI di PC belum |
| cs | 75 | 0 | balas dari info bisnis + ambil alih; nomor WA menunggu Meta |
| approvals | 80 | 80 | notifikasi HP belum |
| tasks | 92,3 | 92,3 | UI anggaran mode hemat belum |
| office | 92,9 | 92,9 | denah 2D isometrik (PR #5), bukan 3D |
| auth, skills, security | 100 | — | subdomain, pustaka skill, kunci terenkripsi |

## Apakah sudah "mirip"?

**Fungsinya mirip, tampilannya sengaja tidak.** Ini keputusan sejak awal, bukan kekurangan:

- **Fitur (68,5).** Alur inti asli: kantor → agent → tugas berantai → riset → naskah → persetujuan
  dari HP → video di PC → jadwal terbit, plus CS WhatsApp. Semuanya sudah jalan ujung ke ujung, tetapi
  baru dengan otak simulasi dan kunci palsu. Yang membuatnya "benar-benar sama" adalah mencobanya dengan
  kunci asli dan akun resmi (WhatsApp, Midtrans, Repliz).
- **Layout (27,1).** Skornya rendah karena warna, kepadatan, gambar, dan copy ditulis sendiri.
  Meniru tampilan Kantorin persis (warna khas + susunan khas + ilustrasi kantornya) adalah trade dress
  mereka. Susunan informasinya sudah setara (form kiri dan harga kanan di beli; denah + status + feed di
  beranda), dan itu yang membuat pengguna yang pindah merasa familier.
- **Kantor virtual.** Asli: pulau 3D dengan karakter mereka. Klon: denah 2D isometrik dengan 8 ruangan
  dan 12 karakter yang dibuat sendiri, status dan gelembung kerja dari data asli. Gunanya sama
  (sekilas tahu siapa bekerja dan siapa menunggu), tanpa memakai aset mereka. Yang belum: 3D/animasi.
- **Dashboard tidak bisa dibandingkan gambar per gambar.** Ia ada di balik login Kantorin, dan sesuai
  keputusan awal kita hanya memakai sumber publik.

## Layout

| layar | asli | klon | skor | sikap |
| --- | --- | --- | --- | --- |
| S01 landing | L01 | `S01-landing-desktop.png` | 24,5 | **pertahankan:** urutan bagian setara (hero, alur, harga, FAQ), ilustrasi dan copy sendiri |
| S03 beli | P02 | `S03-beli-desktop.png` | 35,3 | **pertahankan:** susunan sama; ada pilihan cara bayar tambahan |
| S06 masuk | P01 | `S06-masuk-desktop.png` | 21,6 | **pertahankan:** jalur alamat kantor + password lebih pendek |

Diff image disimpan lokal di `replica/diffs/` dan tidak di-commit karena berisi gambar situs asli.

## Perilaku per flow (yang berubah sejak 14 Nov)

| flow | asli | klon | sikap |
| --- | --- | --- | --- |
| F03 video | render di PC, progres %, approval video, terbit lewat Repliz | render di PC (FFmpeg), narasi ElevenLabs atau diam, footage Pexels, progres %, approval video, jadwal terbit | **perbaiki:** posting otomatis (Repliz) setelah dokumentasi API ada; sementara tandai sudah diposting |
| F05 otomatis | kembali ke manual bila render/posting gagal 2x | belum kembali sendiri | **bangun** (kecil) |
| F08 CS | balas otomatis dari info bisnis | sama + ambil alih chat oleh manusia dan serahkan lagi | **lebih baik** |
| F06 agent | ~6 klik + isian, karakter ditentukan | 3 klik + isian; pilih 1 dari 12 karakter atau acak tetap | setara/lebih baik |
| Beranda | pulau 3D, klik karakter | denah 2D, klik label nama → kartu dengan Periksa/Buka agent | setara fungsi |
| F02 setup | installer + chat asisten | installer Windows (per user, tanpa admin) + tempel kode di aplikasi + chat asisten | setara; **perbaiki:** tanda tangan digital supaya SmartScreen tidak memperingatkan |
| F03 naskah | notifikasi HP → setujui (2 klik) | Persetujuan → item → Setujui (3 klik) | **perbaiki:** web push |

## Yang menahan 13 must

| must | yang dibutuhkan | dari siapa |
| --- | --- | --- |
| otak OpenAI, otak Claude, periset, penulis, cek status AI | dicoba dengan API key asli di `packages/runner/.env` atau dashboard Kunci | pemilik |
| narasi ElevenLabs | API key ElevenLabs asli | pemilik |
| pembayaran lifetime, kantor otomatis (webhook), email akses | akun merchant Midtrans + domain di Resend | pemilik |
| kode setup di halaman pesanan | sengaja di dashboard (lebih aman) | keputusan, bukan kekurangan |
| CS WhatsApp otomatis | status Meta Tech Provider / Embedded Signup | pemilik + Meta |
| posting terjadwal Repliz | dokumentasi API resmi Repliz + akun | pemilik + Repliz |
| halaman legal | nama badan usaha/pengelola, tanggal berlaku, tinjauan ahli hukum | pemilik |

## Lima hal berikutnya

1. **Coba otak AI dengan kunci asli (pemilik, ±30 menit).** Isi kunci OpenAI/Anthropic/ElevenLabs di
   konektor, jalankan satu riset → naskah → video. Kalau lolos, 6 must sebagian jadi penuh. Ini
   kenaikan skor terbesar dengan biaya paling kecil.
2. ~~**Installer konektor Windows.**~~ Selesai: aplikasi tray + installer NSIS, tempel kode, nyala bersama
   Windows, auto-update dari GitHub Releases. Sisa: sertifikat tanda tangan digital (pemilik) dan rilis pertama.
3. ~~**Chat asisten setup.**~~ Iterasi 1 selesai (terpandu tanpa AI, area asisten 25 → 75).
   Iterasi 2: otak AI di PC memakai alat dan kartu konfirmasi yang sama.
4. **Template video per channel (kode, 3 should).** Sebagian: sumber visual + gaya gambar AI per channel sudah ada.
   Sisa: caption, pembuka/penutup per channel, galeri template buatan sendiri, dan pratinjau di browser.
5. **Web push untuk persetujuan + kembali ke manual setelah gagal 2x (kode, 2 should).** Persetujuan
   jadi 2 klik dari notifikasi, mode otomatis aman dari kegagalan berulang.

Paralel dari sisi pemilik: sertifikat code signing Windows (OV/EV, atau Azure Trusted Signing), daftar merchant Midtrans, siapkan domain di Resend, urus Meta Tech Provider,
minta dokumentasi API Repliz, dan siapkan data badan usaha untuk halaman legal.

## Yang sudah lebih baik dari asli

- Masuk dengan alamat kantor + password tanpa menunggu email (F11).
- Kode setup tidak pernah tampil di halaman publik.
- Rantai tugas melingkar ditolak database; run yang terputus kembali antre sendiri.
- Ambil alih chat CS oleh manusia lalu serahkan lagi ke agent.
- Kunci pihak ketiga dienkripsi di browser untuk PC; server tidak bisa membacanya.
- Pilihan 12 karakter per agent, dengan pratinjau di kursinya.
- Installer per user tanpa hak admin; PC bisa diputuskan dari aplikasinya sendiri dan langsung tercabut di dashboard.
- Transfer manual sebagai cadangan pembayaran, dengan panel admin.
- 115 uji end-to-end, termasuk isolasi antar kantor dan aksesibilitas.

---

## Lampiran: keluaran parity.py

```
Parity: 62.6 / 100
features 71.5  (75 counted, must-haves 31 of 44 done)
layout   27.1  (3 screens compared)
Not shippable yet: 13 must-have features are not done.
```

Daftar lengkap "Missing, in build order":
`python <skill>/parity.py replica/features.csv --visual replica/diffs/*.json`.
