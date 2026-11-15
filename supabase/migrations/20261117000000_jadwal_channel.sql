-- Paket B: tabel Channel berkelompok dan grid Jadwal mingguan.

-- Grup channel (mis. "Shorts Indonesia"): hanya untuk mengelompokkan tampilan; kosong = tanpa grup.
alter table public.channels
  add column group_name text not null default '' check (length(group_name) <= 60);

-- Satu slot jam posting hanya untuk satu video. next_post_slot() sudah menghindari slot terpakai;
-- indeks ini menjaga hal yang sama saat pemilik mengisi slot kosong dari antrean (dua klik bersamaan).
create unique index contents_one_per_slot on public.contents (channel_id, scheduled_at)
  where stage = 'scheduled' and scheduled_at is not null;
