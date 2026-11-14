# Bugs: Kantoraiku

Hanya bug yang direproduksi. Dugaan yang belum terbukti ada di bagian "Perlu dicek".
Severity: S1 data hilang / celah keamanan / pembayaran salah / alur inti terblokir;
S2 fitur rusak tanpa jalan lain; S3 rusak dengan jalan lain atau tampak salah; S4 kosmetik.

Ringkasan: 7 bug (S1: 3, S3: 4). Semua sudah diperbaiki; tidak ada S1 yang terbuka.

---

### BUG-001: Halaman atur password terbuka dengan sesi akun lain yang masih aktif

- Severity: S1 (celah keamanan: password akun lain bisa terganti)
- Flow / case: F01 / F01-H3
- Screen: /atur-password
- Build: sebelum 656a502  Browser / device: Chromium (pane), 440px

Steps
1. Login sebagai admin di `/admin/masuk`.
2. Di tab yang sama, buka halaman pesanan pembeli yang sudah lunas, tekan "Atur password dan buka kantor".

Expected: halaman atur password untuk akun pembeli.
Actual: halaman menampilkan "Akun: admin@kantoraiku.test"; mengirim form akan mengganti password admin.
Evidence: replica/backend.md > Uji; pemeriksaan DOM saat uji backend.
Suspected cause: redirect dari server action ke route `/auth/confirm` diproses sebagai navigasi lunak, cookie sesi baru belum terpasang saat `/atur-password` dirender.
Status: fixed in 656a502 (token ditukar jadi sesi di server action yang sama, sesi lama dikeluarkan, email dicocokkan). Dijaga oleh F01-H1/H2/H3.

### BUG-002: Pembeli baru tidak bisa mengatur password pertama

- Severity: S1 (alur inti terblokir)
- Flow / case: F01 / F01-H3
- Screen: /pesanan/[token]
- Build: sebelum 656a502

Steps
1. Admin menandai pesanan lunas.
2. Pembeli menekan "Atur password dan buka kantor".

Expected: halaman atur password.
Actual: dilempar ke halaman masuk kantor, padahal pembeli belum punya password.
Evidence: `auth.users.encrypted_password` berisi hash bcrypt untuk akun yang dibuat tanpa password.
Suspected cause: Supabase Auth mengisi password acak; cek `encrypted_password <> ''` selalu benar.
Status: fixed in 656a502 (penanda `app_metadata.password_set`). Dijaga oleh F01-H1/H2/H3 (termasuk percobaan kedua yang harus ke halaman masuk).

### BUG-003: Konektor gagal melapor hasil: "Kesalahan server"

- Severity: S1 (alur inti terblokir: riset tidak pernah tersimpan)
- Flow / case: F03 / F03-H1
- Screen: API `/api/device/heartbeat`, `/api/device/runs/[id]/complete`
- Build: sebelum 656a502

Steps
1. Pasangkan konektor, jalankan tugas riset.

Expected: topik tersimpan, tugas naskah berjalan.
Actual: `✖ gagal: Kesalahan server`; log: `violates check constraint "topics_sources_check"` dan `devices_ai_status_check`.
Suspected cause: `postgres` v4 men-serialize parameter jsonb sendiri; `JSON.stringify` membuat nilai tersimpan sebagai string JSON.
Status: fixed in 656a502 (objek dikirim apa adanya). Dijaga oleh F03-H1, F02-H1.

### BUG-004: Pesan validasi berbahasa Inggris di form Indonesia

- Severity: S3 (tampak salah, bisa diakali dengan memendekkan isian)
- Flow / case: F01 / F01-E2
- Screen: S03 /beli (juga form agent, channel, tugas)
- Build: 656a502  Browser / device: Chromium 1280px

Steps
1. Buka /beli, isi Nama 200 karakter, isi kolom lain dengan benar, tekan "Buat pesanan".

Expected: pesan Indonesia di bawah kolom Nama.
Actual: "Too big: expected string to have <=120 characters".
Evidence: test F01-E2 (gagal sebelum perbaikan).
Status: fixed in 5029e8b.

### BUG-005: Dua tab memutuskan naskah yang sama: tab kedua error server tanpa pesan

- Severity: S3 (data tetap benar: hanya satu keputusan; pengguna tidak diberi tahu)
- Flow / case: F03 / F03-E4
- Screen: S22 detail konten
- Build: 656a502

Steps
1. Buka naskah yang menunggu persetujuan di dua tab.
2. Tab 1: Setujui. Tab 2: Tolak.

Expected: tab 2 menampilkan "Sudah diputuskan sebelumnya."
Actual: tab 2 tidak menampilkan apa-apa; server: `PostgresError: Persetujuan tidak ditemukan atau sudah diputuskan`, browser: `unhandledRejection`.
Evidence: test F03-E4 (gagal sebelum perbaikan), log dev server.
Suspected cause: error SQL di dalam `sql.begin` menggagalkan seluruh transaksi di `postgres` v4 walau sudah ditangkap (PGlite tidak begitu).
Status: fixed in 5029e8b (kunci baris + cek status sebelum `decide_approval`).

### BUG-006: Jaringan putus saat menekan tombol: error tak tertangani, tanpa pesan

- Severity: S3 (bisa diulang saat online)
- Flow / case: F03 / F03-E9
- Screen: S16 tugas (juga tombol persetujuan, mode channel, kode setup, arsipkan, cabut)
- Build: 656a502

Steps
1. Buka halaman Tugas, putuskan jaringan.
2. Tekan "Jalankan".

Expected: pesan bahwa koneksi gagal.
Actual: tidak ada umpan balik; `pageerror: Failed to fetch`.
Evidence: test F03-E9 (gagal sebelum perbaikan).
Status: fixed in 5029e8b (`useServerCall` + toast; `error.tsx` untuk form).

### BUG-007: Isian form agent dan tugas hilang setelah error validasi

- Severity: S3 (pengguna harus mengetik ulang)
- Flow / case: F06 / F06-E3, F07 / F07-E3
- Screen: S14 agent baru, S16 tugas baru (juga S17 channel baru)
- Build: 656a502

Steps
1. Buat agent bernama sama dengan agent yang sudah ada, isi job desk panjang.
2. Tekan "Buat agent".

Expected: pesan "Sudah ada agent dengan nama ini." dan isian tetap ada.
Actual: pesan muncul, tetapi Jabatan dan Job desk kosong.
Evidence: test F06-E3, F07-E3 (gagal sebelum perbaikan).
Suspected cause: React 19 me-reset form setelah action selesai ke `defaultValue`.
Status: fixed in 5029e8b (nilai yang dikirim dikembalikan dan dipakai sebagai `defaultValue`).

---

## Perlu dicek (belum direproduksi)

- Rate limit per IP (pesanan 5/10 menit, login 10/10 menit) bisa mengenai pengguna di balik NAT bersama (kantor, kampus, operator seluler). Pantau setelah rilis.
- Tombol back / refresh di tengah alur beli dan atur password belum diuji khusus.
- Pembaca layar sungguhan (NVDA / TalkBack): axe lulus di semua layar yang diuji, tapi belum dicoba manual.
- Jaringan lambat (bukan putus): tombol menampilkan loading, belum diuji dengan throttling.
- Zona waktu selain WIB (WITA/WIT) untuk tugas terjadwal: fungsi SQL mendukung, pengaturan zona waktu kantor belum ada di UI.
