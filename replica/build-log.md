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

## Prioritas 6 dari parity: CS WhatsApp, iterasi 1 (branch `build/cs-whatsapp`)

Pendaftaran nomor lewat Embedded Signup butuh status Meta Tech Provider (urusan user), jadi iterasi ini membangun
semua bagian lain dan **simulasi pelanggan** di dashboard untuk mencoba agent CS tanpa WhatsApp.

| ID | layar / bagian | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S25 | `/cs` koneksi, agent CS, simulasi, daftar percakapan | done | Embedded Signup untuk nomor sendiri | — |
| S26 | `/cs/[id]` percakapan, ambil alih, balas sendiri | done | lampiran (gambar, suara) dari agent | agent yang sedang menulis saat diambil alih: balasannya tidak dikirim |
| S27 | `/cs/info` info bisnis | done | — | — |
| — | `/api/webhooks/whatsapp` + kirim lewat Cloud API | done | dicoba dengan nomor sungguhan | tanda tangan HMAC dibandingkan waktu-konstan; status kirim hanya maju; token di Supabase Vault; aturan jendela 24 jam |
| — | konektor: tugas `cs_reply` (simulasi, OpenAI, Claude) | done | — | pesan beruntun dijawab sekali (satu run per percakapan) |

Diuji: `packages/runner/test/cs.test.ts` (3), `e2e/f08-cs.spec.ts` (6); suite 90/90.

## Kunci & integrasi (S30, branch `build/kunci-pc`)

| ID | layar / bagian | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S30 | `/kunci` kunci OpenAI, Anthropic, ElevenLabs, Pexels per PC | done | kunci Repliz (menunggu adapter Repliz) | — |
| — | enkripsi `sealSecret`/`openSecret` (packages/shared) | done | — | dipilih ECIES X25519 + HKDF + AES-GCM lewat WebCrypto, bukan libsodium sealed box seperti di arsitektur: satu implementasi untuk browser dan Node 24 tanpa dependensi; jenis kunci diikat (info + AAD) |
| — | konektor: ambil ulang saat heartbeat melaporkan perubahan | done | — | kunci dashboard menimpa `.env`; bila dihapus, nilai `.env` semula dikembalikan |

Diuji: `packages/runner/test/secrets.test.ts` (3), `e2e/f30-kunci.spec.ts` (4); suite 94/94 (F11-N5 sekali gagal saat suite lambat,
lulus saat diulang: tes batas login sensitif waktu).

## Subdomain per kantor (branch `build/subdomain`)

| bagian | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- |
| `proxy.ts` + `lib/office-host.ts`: `{slug}.APP_DOMAIN/...` -> `/o/{slug}/...` | done | DNS wildcard + SSL di hosting (saat deploy) | tautan internal tetap `/o/{slug}/...` (tetap jalan di subdomain), jadi tidak perlu mengubah puluhan file |
| domain utama `/o/{slug}` -> subdomain; halaman jualan dari subdomain -> domain utama | done (hanya production / `OFFICE_SUBDOMAINS=1`) | **cek saat deploy**: pengalihan subdomain -> domain utama | di dev, server Next menjadikan `Location: http://localhost:3000/...` relatif sehingga berputar; di dev halaman jualan tampil saja di subdomain |
| cookie sesi `.APP_DOMAIN` (production) | done | — | di dev cookie per host: login di `slug.localhost` terpisah dari `localhost` |
| `officeUrl()` di kantor-saya, masuk, pesanan, admin | done | — | — |

Diuji: `e2e/subdomain.spec.ts` (3 aturan + 3 di browser lewat `{slug}.localhost:3000`); suite 100/100; build production lulus.

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

## Kantor virtual 2D (branch `build/kantor-virtual`)

Mockup di kanvas desain disetujui dulu; gambar latar dan 12 karakter dibuat dengan generator gambar Figma dari
deskripsi teks sendiri (referensi hanya gagasan: isometrik, ruangan per fungsi, label nama, gelembung status).

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S11 | beranda: denah kantor | done | animasi jalan, realtime (masih auto-refresh 10 dtk), gelembung CS dari percakapan | kursi ditentukan dari jabatan (`roomFor`), ruangan penuh pindah ke lounge lalu koridor; label tetangga dinaikkan dan gelembung di atas baris label supaya tidak bertumpuk |
| S14 | form agent: penampilan | done | — | `created_at` dari driver postgres berupa `Date`, bukan string |
| S13 | daftar agent: potret karakter | done | — | — |

## Chat asisten setup, iterasi 1 (branch `build/asisten`)

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S28 | `/asisten` chat setup | partial | otak AI di PC (iterasi 2: alat yang sama lewat konektor), pasang VPS lewat chat | asisten membaca keadaan kantor (PC, channel, periset, penulis, skill, tugas) alih-alih naskah tetap, supaya tetap benar kalau pemilik membuat sesuatu di halaman lain; usulan diklaim atomik (`status = pending` → `running`) supaya klik ganda tidak membuat dua kali; kartu yang diganti tidak boleh diredupkan (kontras gagal axe) |

## Konektor Windows (branch `build/konektor-windows`)

Aplikasi tray `apps/connector` (Electron 45 + esbuild + electron-builder) memakai logika kerja yang sama
dengan CLI (`packages/runner`): pairing, heartbeat, ambil tugas, otak AI, render video.

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S29 | perangkat: langkah pasang | done | — | alamat server hanya perlu diisi manual saat dev; di subdomain kantor tetap memakai server bawaan |
| A01 | aplikasi: tempel kode setup | done | tautan `kantoraiku://` dari dashboard (tanpa salin-tempel) | kode boleh ditempel dengan spasi/huruf kecil; token tidak boleh lewat http kecuali localhost |
| A02 | aplikasi: status, tugas berjalan, otak AI, aktivitas | done | — | worker dulu memanggil `process.exit` saat dicabut; sekarang mengembalikan `revoked` dan bisa dihentikan lewat `AbortSignal` (jeda/putuskan/keluar) |
| A03 | installer + start bersama Windows + auto-update | partial | tanda tangan digital (sertifikat dari pemilik), uji auto-update dengan rilis GitHub sungguhan | semua dependensi dibundel esbuild supaya installer tidak membawa `node_modules` pnpm; FFmpeg ikut lewat `extraResources`; `import.meta.url` runner diganti saat bundel CJS |

Rilis: `pnpm --filter @kantoraiku/connector dist` membuat `release/Kantoraiku-Setup.exe` (±135 MB, sebagian besar
FFmpeg + Electron) dan `latest.yml`. Rilis publik (`release` + `GH_TOKEN`) belum dibuat: menunggu keputusan pemilik.
Uji: `e2e/f02-konektor-windows.spec.ts` menjalankan Electron sungguhan (4 tes: pairing + buka ulang, tugas dari
antrean + jeda, putuskan dari aplikasi / dicabut dari dashboard, tombol unduh); versi terpaket `win-unpacked`
dicek manual (FFmpeg terpaket jalan, pairing ke server lokal).

## Visual video dengan gambar AI (branch `build/visual-ai`)

Pexels menghentikan pembuatan API key baru (Nov 2026), jadi footage stok tidak bisa diandalkan untuk user baru.
Gantinya: satu gambar AI per adegan yang digerakkan FFmpeg (zoom masuk, zoom keluar, geser bergantian).

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| S20 | channel: Visual video + Gaya visual | done | — | label opsi panjang terpotong di `<select>`; penjelasan dipindah ke hint |
| S30 | kunci: fal | done | — | menambah baris menggeser indeks tombol di uji kunci lama |
| S22 | konten: keterangan visual | done | — | — |
| — | konektor: gambar AI + gerakan | done | dicoba dengan kunci fal/OpenAI asli | `auto` sengaja tidak memakai kunci OpenAI (dipakai otak agent) supaya biaya gambar tidak muncul tanpa dipilih; gambar di-cache per prompt+seed, revisi ganti seed; adegan yang ditolak filter mencoba prompt dari judul lalu latar polos |

Render 1080x1920: 9 detik video dari 3 gambar selesai ±2,3 detik (FFmpeg `zoompan` dari gambar yang dibesarkan 2x).
Installer konektor perlu dibangun ulang (`pnpm --filter @kantoraiku/connector dist`) supaya membawa fitur ini.

## Paket A: navigasi 6 menu, Konten per keadaan, Pengaturan, Asisten global (branch `build/navigasi-konten`)

Mengikuti struktur dashboard asli yang kini dilihat langsung (`replica/screens/D01–D14`). URL lama tidak dipindah,
hanya dikelompokkan, jadi tautan di chat Asisten, konektor, dan tes lama tetap jalan.

| ID | layar | status | yang belum | lebih sulit dari perkiraan |
| --- | --- | --- | --- | --- |
| — | menu atas 6 menu + bottom nav HP | done | — | di lebar tablet logo dan nama kantor disembunyikan supaya 6 menu muat |
| — | Asisten global (tombol + Ctrl J) | done | — | pintasan baru aktif setelah hydration; panel ditutup otomatis saat pindah halaman (status buka diikat ke path, bukan efek) |
| D02 | Konten: tab per keadaan, saring channel, cari, panel detail | done | Laporan berisi hasil tugas umum saja (briefing Manager menyusul di Paket D) | detail konten dipisah jadi komponen supaya sama di halaman sendiri dan di panel; di HP panel menggantikan daftar |
| — | `/persetujuan` | dialihkan ke Konten | — | — |
| D05 | Agent: tab Agent / Skill / Tugas | done | grup per channel, ruangan, impor (Paket D) | — |
| D06 | Pengaturan › Kantor | partial | acara kantor, briefing, batas revisi, nama samaran (Paket C/D); zona waktu baru ditampilkan | ganti zona waktu butuh hitung ulang jadwal tugas, jadi ditunda |
| D12 | Pengaturan › Akun | done | — | password lama dicek dengan client Supabase sekali pakai lalu sesinya dicabut lokal, supaya sesi browser tidak ikut keluar |
| D09/D07/D11 | PC, Kunci, CS di bawah Pengaturan | done (pengelompokan) | isi baru tiap bagian ada di Paket C | — |

Catatan lingkungan: server dev sempat memuat ulang halaman tanpa henti (juga di `main`); penyebabnya cache
`.next` yang basi. `rm -rf apps/web/.next` lalu jalankan ulang server memperbaikinya.
