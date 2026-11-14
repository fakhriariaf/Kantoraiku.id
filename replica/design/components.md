# Components: Kantoraiku

Spesifikasi setiap komponen dari daftar recon (`replica/recon.md` > Components), plus
state yang belum terlihat tapi wajib ada (focus, disabled, loading, error, empty).
Semua warna, ukuran, dan radius lewat token (`replica/design/tokens.json`), tidak ada
hex di komponen. Kode: `apps/web/src/components/ui/`. Pratinjau semua: route `/design`.

Aturan umum:

- **Fokus**: semua elemen interaktif punya `focus-visible` ring 2px `accent` dengan offset 2px.
  Ring tidak muncul saat diklik mouse.
- **Ukuran sentuh**: target minimal 40px di HP (`control-md`); ikon kecil diberi area klik 40px.
- **Ikon**: Lucide (MIT). Ikon dekoratif `aria-hidden`; tombol ikon wajib `aria-label`.
- **Gerak**: `motion.base` 200ms; semua animasi mati di `prefers-reduced-motion`.
- **Bahasa**: semua label Bahasa Indonesia, ditulis baru (bukan copy Kantorin).
- **Status tidak hanya warna**: setiap status punya teks atau ikon, bukan titik berwarna saja.

---

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 40px, lg 48px, icon (persegi, sama tinggi dengan size)
  states    default, hover, active (turun 1px), focus-visible, disabled, loading (spinner + label tetap)
  tokens    primary: bg accent, hover accent-hover, text on-accent, shadow xs
            secondary: bg surface, border border, text text, hover surface-2
            ghost: transparan, text text-2, hover surface-2
            danger: bg danger, text on-danger
            radius md, font sm/600 (lg: base/600), gap 8
  a11y      <button> asli, atau <a> lewat asChild untuk link; loading -> aria-busy + disabled,
            label tetap dibaca screen reader; tombol ikon wajib aria-label
  used on   semua layar; lg di S01 hero dan S03; sm di kartu dan tabel
```

```
Field (Label + kontrol + bantuan + error)
  parts     Label, Input, Textarea, InputGroup (prefix/suffix), Hint, ErrorText
  sizes     md 40px (default), lg 48px (form publik S03, S06, S10)
  states    default, hover (border border-strong), focus-visible (ring accent, border accent),
            invalid (border danger + ErrorText), disabled (surface-2, text-muted), read-only
  tokens    bg surface, border border-input (3.68:1), radius md, text base, placeholder text-muted
            suffix/prefix: bg surface-2, text text-muted, border kiri/kanan border-input
  a11y      <label for>, Hint dan ErrorText dihubungkan lewat aria-describedby;
            invalid -> aria-invalid="true"; error diumumkan (role="alert" saat submit)
  used on   S03 (alamat kantor: suffix ".kantoraiku.id"), S06, S07, S10, S14, S15, S16, S18, S27, S30
```

```
Select
  variants  native <select> dengan panah Lucide
  states    sama dengan Field
  tokens    sama dengan Input
  a11y      native: keyboard + pembaca layar HP bekerja tanpa kode tambahan
  used on   S14 (otak AI, model), S16 (agent, tugas sumber), S18 (bahasa), S31 (zona waktu)
```

```
SegmentedControl
  variants  2-4 opsi, lebar penuh di HP
  states    selected (bg surface, shadow xs, text text), unselected (text text-muted, hover text-text),
            focus-visible, disabled
  tokens    track bg surface-2, radius md (track) / sm (item), tinggi 36 (item 32), font sm/600
  a11y      Radix ToggleGroup type="single": role radiogroup, panah kiri/kanan berpindah, selalu satu terpilih
  used on   S18 (Manual / Otomatis), S16 (jenis pemicu), S01 (demo alur)
```

```
DayPicker (pilih hari)
  variants  7 tombol bulat Sen-Min
  states    on (bg accent-soft, text accent, border accent), off (border border, text text-2), focus, disabled
  tokens    32px bulat, font xs/600
  a11y      Radix ToggleGroup type="multiple", label "Hari", tiap tombol aria-label nama hari lengkap
  used on   S16
```

```
Switch
  states    on (track accent), off (track border-strong), focus-visible, disabled
  tokens    40x24, knob surface shadow xs
  a11y      Radix Switch (role="switch", aria-checked), selalu berpasangan dengan label teks
  used on   S16 (tugas aktif), S31 (mode hemat), S18 (jam posting aktif)
```

```
Avatar
  variants  inisial 2 huruf; warna avatar-1..8 dipilih stabil dari id agent; badge kecil "bawaan"
  sizes     sm 28, md 36, lg 48
  tokens    bg avatar-n, text on-accent, font xs/700 (lg: sm/700), radius pill
  a11y      dekoratif bila nama tampil di sebelahnya (aria-hidden), selain itu aria-label nama
  used on   S11, S12, S13, S14, S21, S26, S28
```

```
StatusPill
  tones     working (success: titik berdenyut + "Bekerja"), waiting (warning: "Menunggu kamu"),
            ready (text-muted: "Siap"), error (danger: "Bermasalah"), online (success), offline (text-muted),
            soon (warning: "Segera"), available (success: "Tersedia")
  states    statis; titik "working" berdenyut (mati saat reduced-motion)
  tokens    bg *-soft, text tone, titik 6px, radius pill, font xs/600, padding 2x8
  a11y      teks selalu ada; titik aria-hidden
  used on   S13, S14, S21, S24, S29, A01 (status pesanan)
```

```
Chip
  variants  neutral (skill), outline (platform: TikTok/Instagram/YouTube), tag (bawaan/wajib/opsional, mono)
  states    default, removable (tombol x dengan aria-label "Hapus {nama}"), interactive (hover surface-2)
  tokens    neutral: bg surface-2, text text-2; outline: border border; tag: font mono eyebrow
            radius pill (tag: sm), font xs/500, tinggi 24
  used on   S13, S14, S18, S24, S29
```

```
Card
  variants  default (surface, border, shadow card), flat (surface, border, tanpa bayangan),
            dashed (border putus-putus border-strong, untuk "tambah baru"), interactive (hover border-strong)
  tokens    radius xl, padding 16 (HP) / 20 (desktop)
  a11y      kartu yang bisa diklik: seluruh kartu satu <a> atau <button>, isi tidak berisi tombol lain
  used on   semua layar dashboard
```

```
AgentCard
  parts     Avatar + nama + jabatan, StatusPill, label SKILL + Chip, label JADWAL + ikon jam + teks,
            menu ... (DropdownMenu: Ubah, Jalankan sekarang, Arsipkan)
  states    idle, working, waiting_user, error, archived (redup), loading (Skeleton)
  tokens    Card default; label eyebrow text-muted
  a11y      judul kartu = nama agent (h3); menu lewat tombol ikon "Menu {nama}"
  used on   S13 (grid 1 kolom HP, 2 tablet, 3 desktop)
```

```
AddCard
  variants  dashed Card + ikon plus di lingkaran accent-soft + judul + teks pendek
  states    hover (border accent), focus-visible
  a11y      satu <button> atau <a> dengan teks yang jelas ("Buat agent baru")
  used on   S13, S15, S17
```

```
FeedItem / ActivityToast
  parts     Avatar sm + kalimat (nama tebal) + "peran · waktu relatif"
  variants  list (feed S12), toast (melayang di S11, muncul 4 detik)
  states    baru (titik accent di kiri), lama, empty (EmptyState "Belum ada aktivitas")
  tokens    text sm, meta xs text-muted, pemisah border
  a11y      feed = <ol>; waktu pakai <time datetime>; toast di region aria-live="polite"
  used on   S11, S12
```

```
PipelineSteps
  steps     Riset, Naskah, Persetujuan, Video, Terbit (bisa dikurangi per channel)
  states    per langkah: pending (abu), active (accent, ikon berputar), done (success, centang),
            waiting (warning, "Menunggu kamu"), failed (danger), skipped (garis putus, "dilewati")
  layout    horizontal di desktop, vertikal di HP
  tokens    ikon 32 bulat, garis penghubung border / accent saat selesai, label sm/600
  a11y      <ol>, langkah aktif aria-current="step", status ditulis teks (sr-only bila perlu)
  used on   S22, S23, S01
```

```
ApprovalActions
  parts     Setujui (primary), Revisi (secondary, membuka Dialog catatan), Tolak (ghost danger, konfirmasi)
  states    default, loading per tombol, done (diganti teks "Disetujui 09.41"), disabled saat sudah diputuskan
  layout    HP: tombol lebar penuh menempel di bawah (sticky); desktop: sejajar di kanan
  a11y      urutan fokus Setujui -> Revisi -> Tolak; Revisi wajib catatan (Field invalid bila kosong)
  used on   S21, S22
```

```
ProgressBar
  variants  determinate (render %), meter (anggaran AI: hijau < 80%, amber >= 80%, merah 100%)
  tokens    tinggi 6, track surface-2, isi accent / tone, radius pill
  a11y      role="progressbar" aria-valuenow/min/max + label teks ("Render 45%")
  used on   S23, S31
```

```
TemplateCard (Fase 2)
  parts     video 9:16 (autoplay muted loop, berhenti bila reduced-motion atau tombol "Jeda gerakan"),
            nama template, tanda "Dipakai" bila aktif
  states    loading (Skeleton), playing, paused, selected (ring accent)
  a11y      video dekoratif aria-hidden, pilihan lewat <button aria-pressed>
  used on   S19, S20
```

```
ChatBubble
  variants  in (pelanggan: kiri, surface), out (agent: kanan, accent-soft), human (kanan, info-soft + label "Kamu")
  parts     teks, jam, status kirim (Lucide check / check-check), nama agent di header percakapan
  tokens    radius lg dengan sudut pengirim md, text sm, jam xs text-muted
  a11y      thread = <ol>, tiap pesan menyebut pengirim untuk pembaca layar
  used on   S26, S28
```

```
DeviceCard
  variants  pc (tag "wajib"), vps (tag "opsional")
  parts     ikon (monitor / server), nama, StatusPill online/offline/belum dipasang, terakhir terlihat,
            daftar kemampuan, aksi (Ganti nama, Cabut)
  states    not_installed (dashed + tombol "Buat kode setup"), online, offline, revoked
  a11y      Cabut membuka Dialog konfirmasi
  used on   S29, S01
```

```
SetupCode
  parts     kode mono besar dipisah per 4 karakter, tombol Salin, sisa waktu berlaku
  states    aktif, tersalin (ikon centang 2 detik, aria-live "Kode disalin"), kedaluwarsa (redup + tombol buat ulang)
  tokens    font mono xl, bg surface-2, radius lg
  used on   S29
```

```
OptionRow (otak AI, metode bayar)
  parts     nama, sub-teks, StatusPill (Tersedia / Segera), radio
  states    selected (border accent, bg accent-soft), disabled ("Segera"), focus-visible
  a11y      Radix RadioGroup; opsi "Segera" disabled + alasan di sub-teks
  used on   S14 (Claude / OpenAI / ChatGPT login), S03 (Transfer manual / Midtrans)
```

```
PricingCard
  parts     eyebrow, nama paket, harga besar, keterangan "sekali bayar", daftar centang, tombol utama
  tokens    Card default, harga display/2xl, centang success
  used on   S01, S03
```

```
Accordion
  states    tertutup, terbuka (ikon chevron berputar 180), focus-visible
  a11y      Radix Accordion type="single" collapsible: tombol header <h3>, aria-expanded
  used on   S01 (FAQ)
```

```
Eyebrow
  tokens    font mono, type eyebrow (11/16/600, +0.08em, uppercase), text text-muted (marketing: accent)
  used on   label seksi landing, label "SKILL"/"JADWAL" di kartu
```

```
FloatingWhatsApp
  parts     tombol bulat 56px kanan bawah, ikon chat, link wa.me ke ADMIN_WHATSAPP
  a11y      aria-label "Tanya lewat WhatsApp", tidak menutupi tombol sticky di HP (naik di atas bottom bar)
  used on   S01, S03, S05
```

```
Dialog / Sheet
  variants  dialog (tengah, desktop), sheet (dari bawah, HP < md)
  parts     judul, deskripsi, isi, tombol aksi (kanan; HP: tumpuk lebar penuh)
  states    terbuka (overlay hitam 40%), menutup (fade 120ms)
  a11y      Radix Dialog: fokus terkunci, Esc menutup, fokus kembali ke pemicu, aria-labelledby/describedby
  used on   Revisi (catatan), Cabut perangkat, Buat kode setup, Arsipkan agent, konfirmasi admin (A02)
```

```
Toast
  tones     success, error, info
  position  atas (HP: lebar penuh; desktop: kanan atas 384px), karena bawah dipakai bottom nav dan tombol WhatsApp
  states    masuk, tinggal 5 detik (error: sampai ditutup), keluar; bisa di-swipe ke kanan
  a11y      Radix Toast: region aria-live (error: assertive), tombol tutup ber-label
  used on   setelah aksi: simpan, setujui, salin, gagal
```

```
Tooltip
  a11y      Radix Tooltip, muncul saat hover/fokus, tidak dipakai untuk info penting (HP tidak punya hover)
  used on   tombol ikon di desktop
```

```
DropdownMenu
  a11y      Radix DropdownMenu: panah atas/bawah, Esc, item berbahaya pakai teks danger
  used on   AgentCard, DeviceCard, baris tabel admin
```

```
Tabs
  states    aktif (garis bawah accent 2px, text text), tidak aktif (text text-muted), focus-visible
  a11y      Radix Tabs: role tablist, panah kiri/kanan; di HP bisa digeser horizontal
  used on   S14 (Profil / Skill / Tugas), S23 (filter tahap), A01 (status pesanan)
```

```
Banner
  tones     info, warning, danger, success
  parts     ikon, judul tebal, teks, aksi opsional (link/tombol), tutup opsional
  tokens    bg *-soft, border kiri 3px tone, text text, radius lg
  a11y      role="status" (danger: role="alert")
  used on   PC offline ("3 tugas menunggu"), mode hemat aktif, data pembayaran masih dummy (A01), langkah setup
```

```
EmptyState
  parts     ikon Lucide di lingkaran surface-2, judul, satu kalimat, satu aksi utama
  used on   S12, S13, S15, S17, S21 ("Tidak ada yang menunggu kamu"), S24, S25
```

```
Skeleton
  tokens    bg surface-2, kilau lembut (mati di reduced-motion), radius sesuai bentuk asli
  a11y      wadah aria-busy="true", skeleton aria-hidden
  used on   daftar dan kartu saat memuat
```

```
DataList / Table (admin)
  layout    desktop: <table> dengan header surface-2; HP: kartu bertumpuk (label + nilai)
  states    loading, empty, error (Banner + Coba lagi)
  a11y      <th scope>, aksi baris lewat DropdownMenu
  used on   A01, A03, riwayat run (S16)
```

Shell (dispesifikasi di sini, dibangun di `/replica-build`):

```
AppShell (dashboard)
  desktop   sidebar kiri 248 (logo, nama kantor, nav: Kantor, Persetujuan (badge jumlah), Agent, Tugas,
            Channel, CS, Perangkat, Pengaturan), header 64 (judul halaman, status PC, menu akun)
  HP        header 56 + bottom nav 64 (Kantor, Persetujuan, Agent, Lainnya); konten tidak tertutup bottom nav
  a11y      <nav aria-label>, link aktif aria-current="page", "Lewati ke konten" di awal
```

```
MarketingHeader / Footer
  header    sticky 64, latar surface/blur, logo kiri, nav seksi (desktop), Masuk + CTA kanan; HP: menu Sheet
  footer    kontak, link legal, hak cipta
```

```
OfficeMap (S11)
  Fase 1    denah 2D: grid meja (Avatar + nama + StatusPill) per agent, feed di samping
  Fase 4    scene 3D (React Three Fiber) dengan fallback 2D bila WebGL tidak ada atau reduced-motion
```
