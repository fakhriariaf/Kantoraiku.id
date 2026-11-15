-- Penampilan agent di denah kantor: salah satu dari 12 karakter (c01..c12).
-- null = belum dipilih; aplikasi memilihkan karakter tetap dari id agent.
alter table public.agents
  add column appearance text check (appearance is null or appearance ~ '^c(0[1-9]|1[0-2])$');
