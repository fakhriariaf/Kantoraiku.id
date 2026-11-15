-- Paket C: pengaturan kantor, PC, video, dan CS.

-- -----------------------------------------------------------------------------
-- Kantor: batas revisi pemilik, ambang mode hemat, video hanya saat dicas
-- -----------------------------------------------------------------------------
alter table public.offices
  add column max_revisions smallint not null default 3 check (max_revisions between 1 and 10),
  add column saver_threshold_pct smallint not null default 80 check (saver_threshold_pct between 10 and 100),
  add column video_only_charging boolean not null default false;

-- Dilaporkan konektor di setiap heartbeat (laptop memakai baterai).
alter table public.devices add column on_battery boolean not null default false;

-- Kode setup "ganti PC": PC lama dicabut otomatis begitu PC baru tersambung dengan kode ini.
alter table public.setup_codes
  add column replaces_device_id uuid,
  add constraint setup_codes_replaces_fk foreign key (office_id, replaces_device_id)
    references public.devices (office_id, id) on delete set null (replaces_device_id);
create index setup_codes_replaces on public.setup_codes (replaces_device_id);

-- Mode hemat 'auto': nyala bila biaya bulan ini >= ambang (persen) dari anggaran AI.
create or replace function public.office_saver_active(p_office uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case o.saver_mode
    when 'on' then true
    when 'off' then false
    else o.ai_budget_cents is not null and (
      select coalesce(sum(r.cost_usd_micros), 0)
      from public.task_runs r
      where r.office_id = o.id
        and r.finished_at >= (date_trunc('month', now() at time zone o.timezone) at time zone o.timezone)
    ) >= o.ai_budget_cents * 10000 * o.saver_threshold_pct / 100.0   -- 1 sen = 10.000 mikro-dolar
  end
  from public.offices o
  where o.id = p_office;
$$;

-- Sama seperti sebelumnya, ditambah: laptop yang memakai baterai tidak mengambil tugas video
-- bila kantor memilih "buat video hanya saat dicas".
create or replace function public.claim_task_run(p_device_id uuid, p_lease interval default interval '15 minutes')
returns setof public.task_runs
language plpgsql security definer set search_path = '' as $$
declare
  d public.devices;
  r public.task_runs;
  v_saver boolean;
  v_caps text[];
begin
  select * into d from public.devices where id = p_device_id and status <> 'revoked';
  if not found then
    raise exception 'Perangkat tidak dikenal atau dicabut' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.offices o where o.id = d.office_id and o.status = 'active') then
    return;
  end if;
  v_saver := public.office_saver_active(d.office_id);
  v_caps := d.capabilities;
  if d.on_battery and exists (select 1 from public.offices o where o.id = d.office_id and o.video_only_charging) then
    v_caps := array_remove(v_caps, 'video');
  end if;

  loop
    select * into r
    from public.task_runs q
    where q.office_id = d.office_id
      and q.status = 'queued'
      and q.required_capability = any (v_caps)
    order by q.priority desc, q.created_at
    for update skip locked
    limit 1;

    if not found then
      return;
    end if;

    if r.priority = 0 and v_saver then
      update public.task_runs
         set status = 'skipped', skipped_reason = 'Mode hemat: anggaran AI hampir habis', finished_at = now()
       where id = r.id;
      continue;
    end if;

    update public.task_runs
       set status = 'claimed', device_id = d.id, attempts = attempts + 1,
           lease_expires_at = now() + p_lease, started_at = coalesce(started_at, now())
     where id = r.id
     returning * into r;
    return next r;
    return;
  end loop;
end $$;

-- Sama seperti sebelumnya, ditambah batas revisi pemilik per konten per tahap.
create or replace function public.decide_approval(p_approval_id uuid, p_decision text, p_note text default null)
returns public.approvals
language plpgsql security definer set search_path = '' as $$
declare
  a public.approvals;
  c public.contents;
  v_source_task uuid;
  v_max smallint;
begin
  if p_decision not in ('approve','revise','reject') then
    raise exception 'Keputusan tidak dikenal' using errcode = '22023';
  end if;

  update public.approvals
     set decision = p_decision,
         note = nullif(trim(p_note), ''),
         decided_by = auth.uid(),
         decided_at = now()
   where id = p_approval_id
     and decision is null
     and public.is_office_member(office_id)
  returning * into a;
  if not found then
    raise exception 'Persetujuan tidak ditemukan atau sudah diputuskan' using errcode = 'P0002';
  end if;

  select * into c from public.contents where id = a.content_id for update;
  if c.stage <> a.stage || '_review' then
    raise exception 'Konten tidak sedang menunggu review %', a.stage using errcode = '22023';
  end if;

  select r.task_id into v_source_task from public.task_runs r where r.id = a.source_run_id;

  if p_decision = 'approve' then
    update public.contents set stage = a.stage || '_approved' where id = c.id;
    insert into public.task_runs
      (office_id, task_id, agent_id, channel_id, content_id, parent_run_id, trigger_source,
       priority, required_capability, input)
    select t.office_id, t.id, t.agent_id, t.channel_id, c.id, a.source_run_id, 'chain',
           t.priority, t.required_capability, jsonb_build_object('content_id', c.id)
    from public.tasks t
    join public.agents ag on ag.id = t.agent_id and ag.archived_at is null
    where v_source_task is not null and t.after_task_id = v_source_task and t.enabled;

  elsif p_decision = 'revise' then
    if v_source_task is null then
      raise exception 'Tugas sumber sudah dihapus, revisi tidak bisa dijalankan' using errcode = 'P0002';
    end if;
    select o.max_revisions into v_max from public.offices o where o.id = c.office_id;
    if c.revision >= v_max then
      raise exception 'Batas revisi (% kali) sudah tercapai', v_max using errcode = '22023';
    end if;
    update public.contents
       set stage = case a.stage when 'script' then 'scripting' else 'rendering' end,
           revision = revision + 1
     where id = c.id;
    insert into public.task_runs
      (office_id, task_id, agent_id, channel_id, content_id, parent_run_id, trigger_source,
       priority, required_capability, input)
    select t.office_id, t.id, t.agent_id, t.channel_id, c.id, a.source_run_id, 'revision',
           greatest(t.priority, 1::smallint), t.required_capability,
           jsonb_build_object('content_id', c.id, 'revision_note', a.note, 'revision', c.revision + 1)
    from public.tasks t
    where t.id = v_source_task;

  else
    update public.contents set stage = 'rejected' where id = c.id;
  end if;

  return a;
end $$;

-- -----------------------------------------------------------------------------
-- CS WhatsApp: cara CS membalas
-- -----------------------------------------------------------------------------
create table public.cs_settings (
  office_id uuid primary key references public.offices (id) on delete cascade,
  enabled boolean not null default true,                 -- mati: chat tetap tersimpan, CS tidak membalas
  greeting text not null default 'kamu' check (greeting in ('kamu', 'kak')),
  offline_reply text not null default '' check (length(offline_reply) <= 500),  -- kosong = tidak dikirim
  quiet_minutes int not null default 240 check (quiet_minutes between 30 and 10080),
  stale_hours int not null default 12 check (stale_hours between 1 and 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cs_settings enable row level security;  -- tanpa policy: server saja
create trigger set_updated_at before update on public.cs_settings for each row execute function public.set_updated_at();

-- Balasan otomatis yang bukan dari agent (mis. balasan singkat saat PC mati).
alter table public.cs_messages add column auto_kind text check (auto_kind in ('offline'));
