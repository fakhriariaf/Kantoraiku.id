# Test plan: Kantoraiku

Build: 5029e8b (fix) di atas 656a502 (backend)  Date: 2026-11-14  Env: lokal (Next dev + Supabase lokal + konektor CLI), data uji dibuat per tes

Menjalankan: `pnpm db:start`, `pnpm dev`, lalu `pnpm test:e2e` (laporan HTML: `e2e/report/`).
Setiap tes otomatis gagal bila ada console error, respons 5xx, atau pelanggaran aksesibilitas
(axe, WCAG 2.1 A/AA) di layar yang dipindai.

**Hasil: 78 kasus e2e + 11 unit konektor, semuanya lulus** (pembaruan setelah S01/S09 dan otak Claude; awalnya 56). 7 bug ditemukan (3 S1 saat uji backend, 4 S3 saat uji ini), semua diperbaiki.
Layar yang dipindai axe: S03, S05, A01, A02, atur password, S06, S07, S10, S11, S13, S14, S16, S17, S21, S22 (desktop dan HP), S29, dialog revisi: **0 pelanggaran**.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | beli kantor | happy | /beli, isi 4 kolom, Buat pesanan | halaman pesanan "Selesaikan pembayaran", data tersimpan | e2e | ✅ |
| F01-H2 | | happy: admin konfirmasi | admin login, detail pesanan, Tandai lunas | kantor dibuat, banner sukses | e2e | ✅ |
| F01-H3 | | happy: pembeli atur password | halaman pesanan, Atur password, simpan | masuk ke kantor; percobaan kedua ke halaman masuk | e2e | ✅ (BUG-001, BUG-002 dijaga) |
| F01-E1 | | edge: input kosong | kirim form kosong | pesan per kolom | e2e | ✅ |
| F01-E2 | | edge: nama 200 karakter | isi nama sangat panjang | pesan Indonesia, tidak crash | e2e | ✅ setelah BUG-004 |
| F01-E3 | | edge: aksen + emoji | nama "Ayu Sörensen 🌸" | tersimpan dan tampil utuh | e2e | ✅ |
| F01-E4 | | edge: alamat sistem | alamat "admin" | ditolak | e2e | ✅ |
| F01-E5 | | edge: dua tab alamat sama | dua tab pesan alamat sama | tab kedua ditolak, satu pesanan | e2e | ✅ |
| F01-E6 | | edge: klik dobel | dobel klik Buat pesanan | satu pesanan | e2e | ✅ |
| F01-E7 | | edge: spasi/strip di nomor WA | "0812-3456 7890" | tersimpan "081234567890" | e2e | ✅ (dalam H1) |
| F01-E8 | | edge: lebar HP 390px | buka /beli di 390px | tanpa scroll horizontal, axe lulus | e2e | ✅ |
| F01-E9 | | edge: hanya keyboard | Tab + ketik + Enter | pesanan terbuat | e2e | ✅ |
| F01-N1 | | negatif: token tak dikenal | /pesanan/acak | 404 | e2e | ✅ |
| F01-N2 | | negatif: bukan admin | login admin dengan akun biasa | ditolak, /admin terkunci | e2e | ✅ |
| F01-N3 | | negatif: kedaluwarsa | pesanan lewat batas | halaman "Batas waktu lewat", alamat bebas lagi | e2e | ✅ |
| F01-N4 | | negatif: Midtrans ditolak | - | - | - | belum dibangun (Midtrans ditunda) |
| F02-H1 | pasang PC | happy | Buat kode setup di dashboard, `pair` | PC tampil Online | e2e | ✅ |
| F02-N1 | | negatif: kode salah | pair kode acak | ditolak | e2e | ✅ |
| F02-N2 | | negatif: kode dipakai ulang | pair kode yang sama dua kali | ditolak | e2e | ✅ |
| F02-N3 | | negatif: kode kedaluwarsa | kode lewat 1 jam | ditolak | e2e | ✅ |
| F02-N4 | | negatif: slot PC penuh | pair PC kedua | ditolak (409) | e2e | ✅ |
| F02-E1 | | edge: cabut perangkat | menu > Cabut | konektor langsung ditolak | e2e | ✅ |
| F02-M1 | | manual: installer Windows | - | - | - | belum dibangun (CLI dev) |
| F03-H1 | konten manual (inti) | happy | riset -> rantai -> naskah -> persetujuan -> Setujui | konten "Naskah disetujui", inbox kosong | e2e (konektor sungguhan) | ✅ (BUG-003 dijaga) |
| F03-E1 | | edge: PC mati | perangkat offline + tugas antre | banner "PC kamu offline", tugas menunggu | e2e | ✅ |
| F03-E2 | | edge: PC mati di tengah run | lease habis | run kembali antre | db | ✅ |
| F03-E3 | | edge: klik dobel Setujui | dobel klik | satu keputusan | e2e | ✅ |
| F03-E4 | | edge: dua tab | tab 1 setujui, tab 2 tolak | tab 2 diberi tahu, satu keputusan | e2e | ✅ setelah BUG-005 |
| F03-E5 | | edge: sesi habis | hapus cookie, Setujui | ke login, tidak ada keputusan | e2e | ✅ |
| F03-E6 | | edge: HP 390px | detail konten di 390px | bar persetujuan di atas bottom nav, axe lulus | e2e | ✅ |
| F03-E7 | | edge: hanya keyboard | fokus Setujui + Enter | disetujui | e2e | ✅ |
| F03-E8 | | edge: mode hemat | prioritas rendah + mode hemat | run dilewati | db | ✅ |
| F03-E9 | | edge: offline | putus jaringan, Jalankan | toast "Gagal terhubung", halaman utuh | e2e | ✅ setelah BUG-006 |
| F03-N1 | | negatif: OpenAI tanpa kunci | otak OpenAI, tanpa OPENAI_API_KEY | run gagal dengan pesan jelas, agent "Bermasalah" | e2e | ✅ |
| F03-M1 | | manual: OpenAI dengan kunci asli | - | riset web + naskah sungguhan | manual | belum (butuh kunci user) |
| F03-N2 | | negatif: Claude tanpa kunci | otak Claude, tanpa ANTHROPIC_API_KEY | run gagal dengan pesan jelas, Perangkat: "Claude: belum ada kunci" | e2e | ✅ |
| F03-U1 | | unit: otak Claude | server Anthropic palsu: pause_turn, sitasi, 401, refusal | request benar, sumber karangan dibuang, biaya terhitung | unit (node:test) | ✅ 6/6 |
| F03-M2 | | manual: Claude dengan kunci asli | - | riset web + naskah sungguhan | manual | belum (butuh kunci user) |
| F04-H1 | revisi/tolak | happy: revisi | Revisi + catatan, konektor | revisi 1 + riwayat catatan | e2e | ✅ |
| F04-N1 | | negatif: revisi tanpa catatan | Kirim revisi kosong | ditolak | e2e | ✅ |
| F04-H2 | | happy: tolak | Tolak | konten "Ditolak" | e2e | ✅ |
| F05-H1 | mode otomatis | happy | channel otomatis, jalankan | naskah disetujui tanpa persetujuan | e2e | ✅ |
| F05-E1 | | edge: kembali manual lewat UI | segmented Manual, jalankan | naskah menunggu persetujuan | e2e | ✅ |
| F05-M1 | | kembali manual setelah 2 render gagal | - | - | - | belum dibangun (video Fase 2) |
| F06-H1 | buat agent | happy | form agent baru | kartu + banner, axe lulus | e2e | ✅ |
| F06-H2 | | happy: ubah | ubah jabatan | tersimpan | e2e | ✅ |
| F06-H3 | | happy: arsipkan | menu > Arsipkan | hilang dari daftar | e2e | ✅ |
| F06-E1 | | edge: nama 60 karakter | lewati maxlength | ditolak server | e2e | ✅ |
| F06-E2 | | edge: aksen + emoji | "Ñoño 🤖" | tersimpan | e2e | ✅ |
| F06-E3 | | edge: isian setelah error | nama dobel + job desk panjang | isian tetap ada | e2e | ✅ setelah BUG-007 |
| F06-N1 | | negatif: nama dobel | dua agent "Sari"/"sari" | ditolak | e2e | ✅ |
| F06-H4 | | happy: otak Claude | pilih Claude, model kosong | tersimpan brain=claude, model default konektor | e2e | ✅ |
| F07-H1 | tugas berantai | happy | buat tugas riset, lalu tugas "setelah" | label "Setelah ... selesai", rantai di DB | e2e | ✅ |
| F07-E1 | | edge: terjadwal WIB | 06.00 Sen-Jum | label + next_run_at 06.00 WIB hari kerja | e2e | ✅ |
| F07-E2 | | edge: jatuh tempo dua kali | enqueue_due_tasks dua kali | satu run | db | ✅ |
| F07-E3 | | edge: isian setelah error | tugas tanpa channel | isian tetap ada | e2e | ✅ setelah BUG-007 |
| F07-N1 | | negatif: rantai melingkar | A setelah B setelah A | ditolak | db | ✅ |
| F07-N2 | | negatif: riset tanpa channel | tanpa channel | ditolak | e2e | ✅ |
| S15-H1 | pustaka skill | happy | kosong -> buat skill | banner, kartu "Belum dipasang", slug `hook-3-detik` | e2e | ✅ |
| S15-H2 | | happy: pasang ke agent | centang di form agent | chip di kartu agent, "Dipakai 1 agent", isi skill ada di paket kerja konektor | e2e | ✅ |
| S15-H3 | | happy: ubah, hapus | ganti nama, hapus via dialog | slug tetap, skill dilepas dari agent | e2e | ✅ |
| S15-E1 | | edge: nama dobel, instruksi kosong | "gaya SANTAI" dan spasi saja | ditolak, isian tetap | e2e | ✅ |
| S15-E2 | | edge: HP 390px, nama 60 karakter | daftar + form | tanpa scroll horizontal, axe lulus | e2e | ✅ |
| S15-N1 | | negatif: kantor lain | buka skill kantor lain, sisipkan id-nya di form agent | halaman tidak ditemukan, id diabaikan | e2e | ✅ |
| F08 | CS WhatsApp | - | - | - | - | belum dibangun (Fase 3) |
| F09 | pasang VPS | - | - | - | - | belum dibangun (Fase 4) |
| F10-H1 | video di PC | happy | naskah disetujui -> konektor render -> cover -> setujui video | file MP4 di folder PC, cover di bucket privat tampil, "Video disetujui" | e2e | ✅ |
| F10-H2 | | happy: revisi video | Revisi + catatan | dirender ulang, revisi 1, file `-r1.mp4` | e2e | ✅ |
| F10-N1 | | negatif: tanpa naskah disetujui | jalankan tugas video | gagal: "Setujui naskah dulu" | e2e | ✅ |
| F10-N2 | | negatif: cover | bukan JPEG, >200 KB, salah tipe, perangkat kantor lain | 415, 413, 415, 404 | e2e | ✅ |
| F10-E1 | | edge: form tugas | pilih jenis video | penjelasan kunci tampil, axe lulus | e2e | ✅ |
| F10-U1 | | unit: pipeline | render sungguhan 180x320: simulasi, ElevenLabs+Pexels palsu, 401 | durasi ikut narasi, footage potret + kredit, cover JPEG | unit | ✅ 5/5 |
| F10-M1 | | manual: kunci asli ElevenLabs + Pexels | - | narasi dan footage sungguhan | manual | belum (butuh kunci user) |
| F10-T | template video | - | - | - | - | belum dibangun (Fase 2) |
| F11-H1 | masuk | happy: password + keluar | login, Keluar | sesi berakhir, halaman terkunci | e2e | ✅ |
| F11-H2 | | happy: link email | /masuk, Kirim link, buka dari Mailpit | masuk ke kantor | e2e | ✅ |
| F11-H3 | | happy: lupa password | /lupa-password, link Mailpit, password baru | login dengan password baru | e2e | ✅ |
| F11-N1 | | negatif: password salah | | "Email atau password salah." | e2e | ✅ |
| F11-N2 | | negatif: akun kantor lain | | "tidak terdaftar di kantor ini" | e2e | ✅ |
| F11-N3 | | negatif: link dipakai ulang | buka link reset dua kali | ditolak | e2e | ✅ |
| F11-N4 | | negatif: email tak terdaftar | kirim link | jawaban sama (anti-enumerasi) | e2e | ✅ |
| F11-N5 | | negatif: brute force | 11 login salah | "Terlalu banyak percobaan" | e2e | ✅ |
| F11-E2 | | edge: open redirect | /auth/confirm?next=//situs-lain | tetap di situs ini | e2e | ✅ |
| F11-M1 | | manual: email sungguhan | - | sampai di inbox | manual | belum (butuh Resend + domain) |
| F12 | slot PC tambahan | - | - | - | - | belum dibangun (Fase 4) |
| SEC-1/2 | keamanan | user kedua | buka kantor/ID milik user lain | redirect / 404, tidak ada data bocor | e2e | ✅ |
| SEC-3 | | API tanpa token | claim tanpa / token palsu | 401 | e2e | ✅ |
| SEC-4 | | perangkat kantor lain | perangkat B lapor run A | 404, run tidak berubah | e2e | ✅ |
| SEC-5 | | cookie sesi | baca document.cookie | sesi httpOnly | e2e | ✅ |
| SEC-6 | | data dummy | /beli | tidak menampilkan data rekening dummy | e2e | ✅ |
| SEC-7 | | RLS | SQL sebagai user lain dan anon | 0 baris, tulis ditolak | db | ✅ |
| S01-H1..E2 | landing | happy, keyboard, 390px, klaim jujur | lihat `e2e/s01-landing-legal.spec.ts` | harga dari config, FAQ via keyboard, fitur belum ada bertanda Segera, kontak dummy tersembunyi | e2e | ✅ 5/5 |
| S09 | legal | 3 dokumen + link dari form beli | buka dari footer | h1, tanda draf, axe lulus | e2e | ✅ 4/4 |
