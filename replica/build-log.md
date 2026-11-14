# Build log: Kantoraiku

Satu baris per layar. Status: done / partial. Tanggal 2026-11-14, branch `build/vertical-slice`.

## Vertical slice

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S03 | `/beli` form pesanan | done | Midtrans (ditunda, opsi tampil "segera") | — |
| S05 | `/pesanan/[token]` | done | email konfirmasi (Resend) | Next 16 Cache Components: query PGlite memanggil `Date.now()`, wajib `connection()` sebelum baca DB |
| — | `/atur-password` | done | token di URL (pola link reset); pindah ke Supabase Auth di /replica-backend | — |
| S06 | `/masuk` | partial | "kirim link kantor ke email"; sekarang masuk lewat alamat kantor | — |
| A01 | `/admin` daftar pesanan | done | — | file `page.tsx` tidak boleh mengekspor nama lain (dipindah ke modul) |
| A02 | `/admin/pesanan/[id]` | done | — | — |
| S10 | `/o/[slug]/masuk` | done | lupa password lewat WhatsApp admin dulu | — |
| S11 | beranda kantor | partial | kantor 3D (Fase 4); sekarang denah 2D | `useParams` di shell memblokir prerender: `instant = false` di layout dashboard |
| S12 | feed aktivitas | done | Realtime (sekarang auto-refresh 10 dtk) | event sistem tampil "Kantor Kantor dibuat" -> diperbaiki |
| S13 | daftar agent | done | skill (S15) | — |
| S14 | buat/ubah agent | done | form kehilangan isian saat error validasi (React 19 me-reset form action) | — |
| S16 | tugas + riwayat run | done | edit tugas (sekarang hapus + buat ulang) | `setState` di effect -> remount pakai `key` |
| S17 | channel | partial | ubah nama/niche | — |
| S18 | mode channel | partial | jam posting, akun sosmed (Fase 2) | — |
| S21 | persetujuan (inbox) | done | Web Push (Fase 2) | — |
| S22 | detail konten + Setujui/Revisi/Tolak | done | — | bar persetujuan 3 tombol bertumpuk terlalu tinggi di HP -> satu baris |
| S29 | perangkat | done | kunci API lewat dashboard (sealed box) | `<select>` cocok dengan `:read-only` di CSS -> tampak nonaktif, diperbaiki |
| S33 | konektor (CLI dev) | partial | installer Electron, auto-update, code signing | — |

## Prioritas 1 dari parity (branch `build/landing-legal`)

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S01 | `/` landing | done | gambar kantor 3D (diganti contoh kantor dari komponen sendiri), versi Inggris (S02) | klaim harus jujur: video, posting, CS, Claude, VPS belum ada, jadi ditandai "Segera" dari satu sumber (`lib/offer.ts`) |
| S09 | `/syarat-ketentuan`, `/kebijakan-privasi`, `/kebijakan-refund` | partial | identitas pengelola (`LEGAL_ENTITY`), tanggal berlaku, tinjauan ahli hukum; selama itu tampil "Draf" | kebijakan privasi harus cocok dengan skema: daftar data, pemroses, masa simpan (hapus 30 hari setelah kantor ditutup, hash IP 1 hari) diambil dari migrasi |
| — | footer publik | done | WhatsApp disembunyikan selama nomor masih dummy | `Logo` dipindah ke modul sendiri: footer membaca config server, sedangkan app shell adalah client component |

Diuji: `e2e/s01-landing-legal.spec.ts` (9 kasus), seluruh suite 65/65 lulus, axe 0 pelanggaran di 1440px dan 390px.

## Prioritas 2 dari parity: otak Claude (branch `build/otak-claude`)

| ID | bagian | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| — | konektor `brains/claude.ts` | partial | dicoba dengan API key Anthropic asli | web search selalu memberi sitasi, sedangkan structured output menolak sitasi; riset dibuat dua langkah (cari, lalu rapikan jadi JSON), dan sumber disaring ke URL yang benar-benar muncul di hasil pencarian |
| S14 | form agent: pilihan otak Claude | done | — | — |
| S29 | status kunci Claude di Perangkat | done | cek kunci ke Anthropic (sekarang hanya format) | — |

Default model `claude-opus-5-5`, effort `medium` (riset dan naskah) dan `low` (merapikan JSON), fallback server-side
`"default"` saat permintaan ditolak filter keamanan. Biaya per run dihitung dari token + pencarian web.
Diuji: `packages/runner/test/claude.test.ts` (6 kasus, server Anthropic palsu), e2e F03-N2 dan F06-H4; suite 67/67.

## Prioritas 3 dari parity: pustaka skill (branch `build/skill`)

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S15 | `/skill`, `/skill/baru`, `/skill/[id]` | done | pustaka skill bawaan (contoh siap pakai), riwayat versi skill | — (tabel dan pengiriman ke konektor sudah ada sejak skema awal) |
| S14 | form agent: centang skill | done | — | id skill kantor lain harus diabaikan server (diuji S15-N1) |

Diuji: `e2e/f15-skill.spec.ts` (6 kasus, termasuk isi skill sampai ke paket kerja konektor); suite 73/73.

## Prioritas 4 dari parity: video di PC, iterasi 1 (branch `build/video-pc`)

Keputusan user: FFmpeg dulu (bukan Remotion, yang butuh lisensi perusahaan berbayar), footage Pexels, suara simulasi
sampai ada kunci ElevenLabs.

| ID | bagian | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| — | konektor `src/video/` | done | template per channel (S19/S20), Mode Motion, cek frame | subtitle ASS lewat filter `subtitles` dengan path relatif (path Windows di filter FFmpeg sulit di-escape); durasi adegan dibagi menurut jumlah kata supaya teks pas dengan narasi |
| — | API `POST /api/device/contents/[id]/cover` + bucket `covers` | done | pratinjau video low-res untuk HP | hanya perangkat yang merender konten itu yang boleh mengunggah; JPEG dicek dari isi file, bukan header saja |
| S16 | jenis tugas "Buat video dari naskah" | done | — | — |
| S21/S22 | persetujuan video: cover, lokasi file di PC, suara, kredit Pexels | done | menonton video dari HP (butuh pratinjau) | — |

Catatan lisensi: `ffmpeg-static` membawa binary FFmpeg berlisensi GPL. Untuk pengembangan tidak masalah; sebelum
installer Windows dibagikan, putuskan apakah FFmpeg dibundel (dengan kewajiban GPL) atau diunduh terpisah.
Diuji: `packages/runner/test/video.test.ts` (5 kasus, render sungguhan), `e2e/f10-video.spec.ts` (5 kasus); suite 78/78.

## Prioritas 5 dari parity: jadwal terbit (branch `build/jadwal-terbit`)

Keputusan user: bangun bagian umum dulu. API Repliz belum punya dokumentasi resmi (hanya sumber pihak ketiga), dan
posting video tampaknya butuh URL media, padahal video tetap di PC. Adapter Repliz menyusul setelah dokumentasi resmi.

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S18 | `/channel/[id]` atur channel: nama, niche, bahasa, jam posting | done | akun tujuan per platform (Repliz) | — |
| S24 | `/jadwal` jadwal terbit | done | grid kalender, ubah jadwal manual | slot tidak boleh dobel per channel (fungsi `next_post_slot`) |
| — | trigger `contents_schedule_on_approval` | done | — | dipasang di tingkat database supaya jalur manual (decide_approval) dan otomatis (konektor) sama-sama terjadwal |
| S22 | kartu Terbit + "Tandai sudah diposting" | done | posting otomatis | label tombol harus memuat teks yang terlihat (axe: label-content-name-mismatch) |

Diuji: `e2e/f24-jadwal.spec.ts` (6 kasus); suite 84/84.

## Diuji end-to-end (browser + konektor, mode simulasi)

beli (transfer manual) -> admin tandai lunas -> atur password -> masuk kantor -> buat channel,
2 agent, 2 tugas berantai -> buat kode setup -> `pair` konektor -> "Jalankan" riset ->
konektor: riset -> rantai -> naskah -> persetujuan muncul -> Revisi (catatan wajib) ->
konektor menulis revisi 1 -> Setujui. Jalur error: agent ber-otak OpenAI tanpa API key ->
run gagal dengan pesan jelas, status agent "Bermasalah", tercatat di feed.

Pemeriksaan: `tsc` web + runner bersih, `eslint` bersih, `next build` lolos (semua halaman
dashboard Partial Prerender). Lebar HP (425-440 px) dan desktop (1280 px) dicek.

## Belum diuji

- Otak OpenAI dengan API key asli (butuh `OPENAI_API_KEY` di `packages/runner/.env`).
  Model default `gpt-6-astra` diambil dari contoh dokumentasi OpenAI; bila ditolak (404), ganti model di form agent.
- Mode otomatis channel (kode ada, belum dijalankan end-to-end).
- Tugas terjadwal menunggu jam jadwal di browser (fungsi SQL-nya teruji di skema awal + PGlite).
- Keyboard-only untuk seluruh alur (Tab antar-field dan dialog sudah dicek, belum seluruh layar).

## Lebih besar dari kelihatannya

- **Next 16 Cache Components** mengubah cara menulis halaman berbasis DB: setiap baca data harus
  di dalam `<Suspense>` dan setelah `connection()`. Polanya sekarang konsisten (helper `requireMember`,
  `requireAdmin`, `requestNow`), tapi ini akan berlaku juga saat pindah ke Supabase.
