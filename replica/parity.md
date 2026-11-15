# Parity: Kantoraiku vs Kantorin

Tanggal: 2026-11-15  Build: branch `build/asisten` (setelah PR #5 kantor virtual 2D + chat asisten iterasi 1)
Sumber: `replica/features.csv`, screenshot publik di `replica/screens/`, klon di `replica/clone-screens/`.
Dihitung dengan `parity.py` dan `imgdiff.py` dari skill replica-diff.

## Angka

| | sekarang | 14 Nov | arti |
| --- | --- | --- | --- |
| **Keseluruhan** | **61,1 / 100** | 41,1 | 80% fitur + 20% layout |
| **Fitur** | **69,6** | 44,3 | 75 fitur dihitung |
| Must selesai | **30 dari 44** | 19 dari 44 | 14 must sisa: 2 belum ada, 12 sebagian |
| Layout | 27,1 | 28,4 | 3 layar publik; sengaja tidak meniru (lihat di bawah) |
| Bug S1/S2 terbuka | 0 | 0 | lihat `replica/bugs.md` |
| Uji e2e | 111 lolos | 56 | |

**Putusan: belum layak rilis.** Masih ada 14 must yang belum penuh. Tapi hampir semuanya tidak lagi
tertahan kode: 12 dari 14 menunggu akun, kunci, atau data dari pemilik, 1 sengaja dibuat beda, dan
hanya 1 yang masih pekerjaan kode murni (tabel "Yang menahan" di bawah).

Bobot: must 3, should 2, could 1; "sebagian" dihitung setengah. Baris `skip` (aset, copy, dan persona
Kantorin, login langganan Claude, WhatsApp Web tidak resmi) dan fitur tambahan Kantoraiku sendiri
tidak ikut dihitung.

## Per area (terlemah dulu)

| area | skor | 14 Nov | keterangan |
| --- | --- | --- | --- |
| connector | 47,4 | 47,4 | CLI dev; installer Windows, Mac, VPS, auto-update belum |
| purchase | 47,5 | 45 | Midtrans, webhook, dan email pesanan menunggu akun merchant + Resend |
| video | 47,7 | 0 | render di PC, narasi, footage jalan; template video belum |
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
| F02 setup | installer + chat Pandu | kode setup + perintah terminal | **perbaiki:** installer Windows, chat asisten |
| F03 naskah | notifikasi HP → setujui (2 klik) | Persetujuan → item → Setujui (3 klik) | **perbaiki:** web push |

## Yang menahan 14 must

| must | yang dibutuhkan | dari siapa |
| --- | --- | --- |
| otak OpenAI, otak Claude, periset, penulis, cek status AI | dicoba dengan API key asli di `packages/runner/.env` atau dashboard Kunci | pemilik |
| narasi ElevenLabs | API key ElevenLabs asli | pemilik |
| pembayaran lifetime, kantor otomatis (webhook), email akses | akun merchant Midtrans + domain di Resend | pemilik |
| kode setup di halaman pesanan | sengaja di dashboard (lebih aman) | keputusan, bukan kekurangan |
| CS WhatsApp otomatis | status Meta Tech Provider / Embedded Signup | pemilik + Meta |
| posting terjadwal Repliz | dokumentasi API resmi Repliz + akun | pemilik + Repliz |
| halaman legal | nama badan usaha/pengelola, tanggal berlaku, tinjauan ahli hukum | pemilik |
| konektor Windows | installer (Electron) + code signing | **kode** (sertifikat signing dari pemilik) |

## Lima hal berikutnya

1. **Coba otak AI dengan kunci asli (pemilik, ±30 menit).** Isi kunci OpenAI/Anthropic/ElevenLabs di
   konektor, jalankan satu riset → naskah → video. Kalau lolos, 6 must sebagian jadi penuh. Ini
   kenaikan skor terbesar dengan biaya paling kecil.
2. **Installer konektor Windows (kode).** Satu-satunya must yang masih pekerjaan kode murni. Electron +
   pairing lewat kode setup di layar, start saat Windows menyala, auto-update (should) sekalian.
3. ~~**Chat asisten setup.**~~ Iterasi 1 selesai (terpandu tanpa AI, area asisten 25 → 75).
   Iterasi 2: otak AI di PC memakai alat dan kartu konfirmasi yang sama.
4. **Template video per channel (kode, 3 should).** Caption, tampilan, pembuka/penutup per channel,
   galeri template buatan sendiri, dan pratinjau di browser. 57 template asli tidak diambil.
5. **Web push untuk persetujuan + kembali ke manual setelah gagal 2x (kode, 2 should).** Persetujuan
   jadi 2 klik dari notifikasi, mode otomatis aman dari kegagalan berulang.

Paralel dari sisi pemilik: daftar merchant Midtrans, siapkan domain di Resend, urus Meta Tech Provider,
minta dokumentasi API Repliz, dan siapkan data badan usaha untuk halaman legal.

## Yang sudah lebih baik dari asli

- Masuk dengan alamat kantor + password tanpa menunggu email (F11).
- Kode setup tidak pernah tampil di halaman publik.
- Rantai tugas melingkar ditolak database; run yang terputus kembali antre sendiri.
- Ambil alih chat CS oleh manusia lalu serahkan lagi ke agent.
- Kunci pihak ketiga dienkripsi di browser untuk PC; server tidak bisa membacanya.
- Pilihan 12 karakter per agent, dengan pratinjau di kursinya.
- Transfer manual sebagai cadangan pembayaran, dengan panel admin.
- 111 uji end-to-end, termasuk isolasi antar kantor dan aksesibilitas.

---

## Lampiran: keluaran parity.py

```
Parity: 61.1 / 100
features 69.6  (75 counted, must-haves 30 of 44 done)
layout   27.1  (3 screens compared)
Not shippable yet: 14 must-have features are not done.
```

Daftar lengkap "Missing, in build order":
`python <skill>/parity.py replica/features.csv --visual replica/diffs/*.json`.
