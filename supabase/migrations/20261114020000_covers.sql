-- Cover kecil video (Fase 2). Video final tetap di PC; server hanya menyimpan JPEG <= 200 KB.
-- Bucket privat: hanya server (secret key) yang menulis; dashboard membaca lewat signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', false, 204800, array['image/jpeg'])
on conflict (id) do nothing;
