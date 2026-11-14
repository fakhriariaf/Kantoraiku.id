-- Rate limit sederhana di Postgres untuk endpoint publik (pesan, cek alamat, login, kirim link).
-- Kunci berisi hash IP + nama aksi: tidak ada IP mentah yang disimpan.

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0 check (hits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);
create index rate_limits_window on public.rate_limits (window_start);
alter table public.rate_limits enable row level security; -- tanpa policy: server saja

create trigger set_updated_at before update on public.rate_limits
  for each row execute function public.set_updated_at();

-- true = boleh lanjut; false = sudah lewat batas di jendela waktu ini.
create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  return n <= p_max;
end $$;

revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

select cron.schedule('cleanup-rate-limits', '17 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '1 day'$$);
