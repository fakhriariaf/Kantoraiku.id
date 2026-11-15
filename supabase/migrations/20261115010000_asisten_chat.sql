-- Chat asisten setup (S28), iterasi 1: asisten terpandu tanpa AI.
-- data: tombol balasan cepat, tautan, usulan alat (dikonfirmasi pemilik), dan status percakapan.
alter table public.assistant_messages
  add column data jsonb not null default '{}' check (jsonb_typeof(data) = 'object');
