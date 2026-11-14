-- Jadwal terbit (Fase 2, bagian umum): video yang disetujui masuk ke slot jam posting channel berikutnya.
-- Posting otomatis ke platform (Repliz) menyusul; sampai itu pemilik menandai "sudah diposting" sendiri.

-- Slot jam posting berikutnya setelah p_after yang belum dipakai konten lain di channel itu.
-- Null bila channel belum punya jam posting.
create or replace function public.next_post_slot(p_channel_id uuid, p_after timestamptz)
returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_times time[];
  v_tz text;
  v_slot timestamptz := p_after;
begin
  select c.post_times, o.timezone into v_times, v_tz
    from public.channels c join public.offices o on o.id = c.office_id
   where c.id = p_channel_id;
  if v_times is null or coalesce(array_length(v_times, 1), 0) = 0 then
    return null;
  end if;
  for i in 1..200 loop
    v_slot := public.next_run_after(v_times, '{1,2,3,4,5,6,7}'::smallint[], v_tz, v_slot);
    exit when v_slot is null;
    if not exists (
      select 1 from public.contents
       where channel_id = p_channel_id and scheduled_at = v_slot and stage in ('scheduled', 'published')
    ) then
      return v_slot;
    end if;
  end loop;
  return null;
end $$;

revoke execute on function public.next_post_slot(uuid, timestamptz) from public, anon, authenticated;

-- Video disetujui (manual lewat decide_approval, atau otomatis dari konektor) -> langsung terjadwal.
create or replace function public.contents_schedule_on_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slot timestamptz;
begin
  if new.stage = 'video_approved' and old.stage is distinct from 'video_approved' then
    v_slot := public.next_post_slot(new.channel_id, now());
    if v_slot is not null then
      new.stage := 'scheduled';
      new.scheduled_at := v_slot;
    end if;
  end if;
  return new;
end $$;

create trigger contents_schedule_on_approval
  before update of stage on public.contents
  for each row execute function public.contents_schedule_on_approval();

create index contents_schedule on public.contents (office_id, stage, scheduled_at);
