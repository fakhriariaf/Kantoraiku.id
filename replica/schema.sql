-- =============================================================================
-- Kantoraiku: skema awal (migration 0001)
-- Postgres 15+ di Supabase. Semua waktu timestamptz (UTC). Uang: integer + currency.
--
-- Akses:
--   * Browser (role `authenticated`): Row Level Security. Setiap tabel milik
--     kantor punya kolom office_id dan dicek lewat public.is_office_member().
--   * Server (route device, webhook Midtrans/WhatsApp, panel admin, cron):
--     koneksi service (Drizzle) yang melewati RLS, dengan cek office_id
--     eksplisit di data layer.
--   * Referensi antar-baris di dalam satu kantor memakai composite foreign key
--     (office_id, x_id) supaya baris kantor A tidak bisa menunjuk baris kantor B.
-- =============================================================================

create extension if not exists pgcrypto;
-- pg_cron: aktifkan lewat Supabase Dashboard > Database > Extensions.
create extension if not exists pg_cron;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Platform
-- -----------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reserved_slugs (
  slug text primary key check (slug = lower(slug)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Kantor, pesanan, pembayaran
-- -----------------------------------------------------------------------------

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),          -- 3-30, tidak bisa diganti
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  timezone text not null default 'Asia/Jakarta',                  -- WIB/WITA/WIT, divalidasi di app
  language text not null default 'id' check (language in ('id','en')),
  pc_slots int not null default 1 check (pc_slots >= 1),
  saver_mode text not null default 'auto' check (saver_mode in ('off','auto','on')),
  ai_budget_cents bigint check (ai_budget_cents is null or ai_budget_cents >= 0),
  ai_budget_currency text not null default 'USD' check (ai_budget_currency = 'USD'),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  closed_at timestamptz,
  order_id uuid unique,                                           -- FK ditambah setelah tabel orders
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closed_has_time check ((status = 'closed') = (closed_at is not null))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{6,40}$'),  -- dipakai sebagai Midtrans order_id dan kode di WA
  public_token text not null unique check (length(public_token) >= 32), -- URL halaman pesanan, dibuat di app
  kind text not null default 'office' check (kind in ('office','pc_slot')),
  office_id uuid references public.offices (id) on delete set null,    -- data transaksi disimpan walau kantor dihapus
  buyer_name text not null check (length(trim(buyer_name)) between 1 and 120),
  buyer_email text not null check (buyer_email = lower(buyer_email) and buyer_email like '%_@_%'),
  buyer_whatsapp text not null check (buyer_whatsapp ~ '^\+?[0-9]{9,15}$'),
  office_slug text check (office_slug is null or office_slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  amount bigint not null check (amount > 0),                      -- IDR dalam rupiah utuh (gross_amount Midtrans tanpa desimal)
  currency text not null default 'IDR' check (currency = 'IDR'),
  payment_method text not null check (payment_method in ('midtrans','manual')),
  status text not null default 'pending'
    check (status in ('pending','paid','expired','cancelled','refunded')),
  midtrans_transaction_id text,
  paid_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null, -- admin yang mengonfirmasi transfer manual
  admin_note text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_order_has_slug check (kind <> 'office' or office_slug is not null),
  constraint slot_order_has_office check (kind <> 'pc_slot' or office_id is not null),
  constraint paid_has_time check ((status in ('paid','refunded')) = (paid_at is not null))
);
-- Slug dipesan selama pesanan masih menunggu pembayaran: dua pembeli tidak bisa memesan slug yang sama.
create unique index orders_pending_slug on public.orders (office_slug)
  where status = 'pending' and kind = 'office';
create index orders_status_created on public.orders (status, created_at desc);
create index orders_buyer_email on public.orders (buyer_email);
create index orders_office on public.orders (office_id);
create index orders_expiring on public.orders (expires_at) where status = 'pending';
create index orders_confirmed_by on public.orders (confirmed_by);

alter table public.offices
  add constraint offices_order_fk foreign key (order_id) references public.orders (id) on delete set null;

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('midtrans','manual')),
  provider_event_key text not null,          -- midtrans: transaction_id:transaction_status:status_code
  transaction_status text not null,
  fraud_status text,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_key)      -- notifikasi ganda dari Midtrans diabaikan
);
create index payment_events_order on public.payment_events (order_id, received_at);

create table public.office_members (
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (office_id, user_id)
);
create index office_members_user on public.office_members (user_id);

-- Helper RLS. security definer supaya tidak rekursif ke policy office_members.
create or replace function public.is_office_member(p_office uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members m
    where m.office_id = p_office and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_office_owner(p_office uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members m
    where m.office_id = p_office and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- -----------------------------------------------------------------------------
-- Perangkat (konektor PC / VPS) dan kunci terenkripsi
-- -----------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  kind text not null check (kind in ('pc_windows','pc_mac','vps_linux')),
  name text not null check (length(trim(name)) between 1 and 60),
  token_hash text not null unique,                 -- sha256(device token); token asli hanya di perangkat
  public_key text not null,                        -- X25519 (base64) untuk sealed box dari browser
  connector_version text,
  status text not null default 'offline' check (status in ('online','offline','revoked')),
  last_seen_at timestamptz,
  ai_status jsonb not null default '{}' check (jsonb_typeof(ai_status) = 'object'),
                                                   -- {"claude":"ok|missing_key|invalid_key","openai":"ok|missing_key|chatgpt_ok"}
  capabilities text[] not null default '{agents}' check (capabilities <@ array['agents','video']),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  constraint revoked_has_time check ((status = 'revoked') = (revoked_at is not null))
);
create index devices_office on public.devices (office_id);
create index devices_online on public.devices (last_seen_at) where status = 'online';

create table public.device_secrets (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  device_id uuid not null,
  kind text not null
    check (kind in ('anthropic_api_key','openai_api_key','elevenlabs_api_key','repliz_api_key')),
  ciphertext text not null,                        -- crypto_box_seal ke devices.public_key, dibuat di browser
  hint text check (hint is null or length(hint) <= 8),  -- 4 karakter terakhir untuk tampilan
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, kind),
  foreign key (office_id, device_id) references public.devices (office_id, id) on delete cascade
);
create index device_secrets_office on public.device_secrets (office_id);

create table public.setup_codes (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  code_hash text not null unique,                  -- sha256(kode); kode asli ditampilkan sekali di dashboard
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (office_id, used_by_device_id)
    references public.devices (office_id, id) on delete set null (used_by_device_id),
  constraint device_implies_used check (used_by_device_id is null or used_at is not null)
);
create index setup_codes_office on public.setup_codes (office_id, created_at desc);
create index setup_codes_device on public.setup_codes (used_by_device_id);
create index setup_codes_created_by on public.setup_codes (created_by);

-- -----------------------------------------------------------------------------
-- Agent dan skill
-- -----------------------------------------------------------------------------

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  title text not null check (length(trim(title)) between 1 and 60),        -- jabatan
  job_description text not null default '' check (length(job_description) <= 8000),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  kind text not null default 'custom' check (kind in ('custom','assistant')),  -- assistant = asisten setup bawaan
  brain text not null default 'claude' check (brain in ('claude','openai')),
  model text,                                       -- null = model default untuk brain
  auth_mode text not null default 'api_key' check (auth_mode in ('api_key','chatgpt_plan')),
  status text not null default 'idle' check (status in ('idle','working','waiting_user','error')),
  desk_index int check (desk_index is null or desk_index >= 0),   -- posisi meja di denah kantor
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  constraint chatgpt_plan_needs_openai check (auth_mode <> 'chatgpt_plan' or brain = 'openai')
);
create unique index agents_office_name on public.agents (office_id, lower(name)) where archived_at is null;
create index agents_office on public.agents (office_id);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$'),
  name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  body_md text not null default '' check (length(body_md) <= 50000),  -- jadi SKILL.md / AGENTS.md di PC
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  unique (office_id, slug)
);
create index skills_office on public.skills (office_id);

create table public.agent_skills (
  office_id uuid not null references public.offices (id) on delete cascade,
  agent_id uuid not null,
  skill_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agent_id, skill_id),
  foreign key (office_id, agent_id) references public.agents (office_id, id) on delete cascade,
  foreign key (office_id, skill_id) references public.skills (office_id, id) on delete cascade
);
create index agent_skills_skill on public.agent_skills (skill_id);
create index agent_skills_office on public.agent_skills (office_id);

-- -----------------------------------------------------------------------------
-- Channel konten, template, akun sosial
-- -----------------------------------------------------------------------------

create table public.video_templates (                 -- katalog global milik Kantoraiku
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{2,64}$'),
  name text not null,
  kind text not null check (kind in ('motion','footage')),
  preview_url text,
  default_props jsonb not null default '{}' check (jsonb_typeof(default_props) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  niche text not null default '' check (length(niche) <= 2000),
  content_language text not null default 'id' check (content_language ~ '^[a-z]{2}$'),
  mode text not null default 'manual' check (mode in ('manual','auto')),
  post_times time[] not null default '{}',          -- jam lokal kantor
  video_mode text not null default 'footage' check (video_mode in ('footage','motion')),
  active_template_version_id uuid,                  -- FK ditambah setelah channel_template_versions
  consecutive_failures int not null default 0 check (consecutive_failures >= 0),
  auto_paused_reason text,                          -- diisi saat otomatis kembali ke manual
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id)
);
create index channels_office on public.channels (office_id);

create table public.channel_template_versions (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  channel_id uuid not null,
  video_template_id uuid not null references public.video_templates (id) on delete restrict,
  version int not null check (version >= 1),
  caption_style jsonb not null default '{}' check (jsonb_typeof(caption_style) = 'object'),
  look jsonb not null default '{}' check (jsonb_typeof(look) = 'object'),
  voice jsonb not null default '{}' check (jsonb_typeof(voice) = 'object'),   -- voice_id ElevenLabs, setelan
  intro jsonb not null default '{}' check (jsonb_typeof(intro) = 'object'),
  outro jsonb not null default '{}' check (jsonb_typeof(outro) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  unique (channel_id, version),
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade
);
create index ctv_template on public.channel_template_versions (video_template_id);
create index ctv_office on public.channel_template_versions (office_id);
create index ctv_created_by on public.channel_template_versions (created_by);

alter table public.channels
  add constraint channels_active_template_fk
  foreign key (office_id, active_template_version_id)
  references public.channel_template_versions (office_id, id)
  on delete set null (active_template_version_id);
create index channels_active_template on public.channels (active_template_version_id);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  platform text not null
    check (platform in ('facebook','instagram','threads','youtube','x','tiktok')),
  handle text not null,
  repliz_account_id text not null,                  -- dilaporkan konektor (kunci Repliz ada di PC)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  unique (office_id, repliz_account_id)
);

create table public.channel_accounts (
  office_id uuid not null references public.offices (id) on delete cascade,
  channel_id uuid not null,
  social_account_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel_id, social_account_id),
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade,
  foreign key (office_id, social_account_id) references public.social_accounts (office_id, id) on delete cascade
);
create index channel_accounts_account on public.channel_accounts (social_account_id);
create index channel_accounts_office on public.channel_accounts (office_id);

-- -----------------------------------------------------------------------------
-- Tugas dan eksekusinya
-- -----------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  agent_id uuid not null,
  channel_id uuid,                                  -- null = tugas umum
  name text not null check (length(trim(name)) between 1 and 80),
  instructions text not null default '' check (length(instructions) <= 8000),
  kind text not null default 'general'
    check (kind in ('general','research','script','video','publish','cs_reply')),
  trigger text not null check (trigger in ('schedule','after_task','manual','event')),
  schedule_times time[] not null default '{}',      -- jam lokal kantor
  schedule_days smallint[] not null default '{1,2,3,4,5,6,7}'
    check (schedule_days <@ array[1,2,3,4,5,6,7]::smallint[]),   -- ISO: 1 = Senin
  after_task_id uuid,
  priority smallint not null default 1 check (priority between 0 and 2),  -- 0 rendah (dilewati mode hemat)
  required_capability text not null default 'agents' check (required_capability in ('agents','video')),
  enabled boolean not null default true,
  next_run_at timestamptz,                          -- diisi trigger, dipakai enqueue_due_tasks()
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  foreign key (office_id, agent_id) references public.agents (office_id, id) on delete cascade,
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade,
  foreign key (office_id, after_task_id)
    references public.tasks (office_id, id) on delete set null (after_task_id),
  constraint schedule_needs_times check (trigger <> 'schedule' or cardinality(schedule_times) > 0),
  constraint chain_needs_parent check (trigger <> 'after_task' or after_task_id is not null),
  constraint not_own_parent check (after_task_id is distinct from id),
  constraint content_task_needs_channel
    check (kind not in ('research','script','video','publish') or channel_id is not null)
);
create index tasks_office on public.tasks (office_id);
create index tasks_agent on public.tasks (agent_id);
create index tasks_channel on public.tasks (channel_id);
create index tasks_after on public.tasks (after_task_id);
create index tasks_due on public.tasks (next_run_at) where enabled and trigger = 'schedule';

create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  task_id uuid not null,
  agent_id uuid not null,
  channel_id uuid,
  content_id uuid,                                  -- FK ditambah setelah tabel contents
  parent_run_id uuid,
  trigger_source text not null
    check (trigger_source in ('schedule','chain','manual','revision','event','retry')),
  scheduled_for timestamptz,                        -- slot jadwal; kunci idempotensi enqueue
  status text not null default 'queued'
    check (status in ('queued','claimed','running','succeeded','failed','skipped','cancelled')),
  priority smallint not null default 1 check (priority between 0 and 2),
  required_capability text not null default 'agents' check (required_capability in ('agents','video')),
  device_id uuid,
  lease_expires_at timestamptz,
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts >= 1),
  input jsonb not null default '{}' check (jsonb_typeof(input) = 'object'),
  result_md text,
  output jsonb,
  error text,
  skipped_reason text,
  progress_pct smallint check (progress_pct is null or progress_pct between 0 and 100),
  progress_message text,
  cost_usd_micros bigint not null default 0 check (cost_usd_micros >= 0),  -- 1 USD = 1.000.000
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  foreign key (office_id, task_id) references public.tasks (office_id, id) on delete cascade,
  foreign key (office_id, agent_id) references public.agents (office_id, id) on delete cascade,
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade,
  foreign key (office_id, parent_run_id)
    references public.task_runs (office_id, id) on delete set null (parent_run_id),
  foreign key (office_id, device_id)
    references public.devices (office_id, id) on delete set null (device_id),
  constraint leased_has_device check (status not in ('claimed','running') or device_id is not null),
  constraint finished_has_time
    check ((status in ('succeeded','failed','skipped','cancelled')) = (finished_at is not null))
);
create unique index task_runs_schedule_slot on public.task_runs (task_id, scheduled_for)
  where scheduled_for is not null;
create index task_runs_queue on public.task_runs (office_id, required_capability, priority desc, created_at)
  where status = 'queued';
create index task_runs_lease on public.task_runs (lease_expires_at) where status in ('claimed','running');
create index task_runs_task on public.task_runs (task_id, created_at desc);
create index task_runs_agent on public.task_runs (agent_id, created_at desc);
create index task_runs_channel on public.task_runs (channel_id);
create index task_runs_content on public.task_runs (content_id);
create index task_runs_parent on public.task_runs (parent_run_id);
create index task_runs_device on public.task_runs (device_id);
create index task_runs_office_finished on public.task_runs (office_id, finished_at);  -- biaya bulan ini

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  channel_id uuid not null,
  run_id uuid,
  title text not null check (length(trim(title)) between 1 and 300),
  angle text,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),  -- [{url,title}]
  score smallint check (score is null or score between 0 and 100),
  status text not null default 'new' check (status in ('new','picked','discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade,
  foreign key (office_id, run_id) references public.task_runs (office_id, id) on delete set null (run_id)
);
create index topics_channel on public.topics (channel_id, created_at desc);
create index topics_office on public.topics (office_id);
create index topics_run on public.topics (run_id);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  channel_id uuid not null,
  topic_id uuid,
  title text not null check (length(trim(title)) between 1 and 300),
  script text,
  visual_plan jsonb not null default '[]' check (jsonb_typeof(visual_plan) = 'array'),
  word_count int check (word_count is null or word_count >= 0),
  duration_s int check (duration_s is null or duration_s >= 0),
  stage text not null default 'scripting'
    check (stage in ('scripting','script_review','script_approved','rendering','video_review',
                     'video_approved','scheduled','published','rejected','failed')),
  revision int not null default 0 check (revision >= 0),
  cover_path text,                                  -- Supabase Storage, gambar kecil
  preview_path text,                                -- pratinjau low-res sementara (Fase 2)
  preview_expires_at timestamptz,
  device_id uuid,                                   -- PC yang menyimpan file video
  video_local_ref text,                             -- path/ID di PC; video tidak disimpan di server
  scheduled_at timestamptz,
  published_at timestamptz,
  publish_results jsonb not null default '[]' check (jsonb_typeof(publish_results) = 'array'),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  foreign key (office_id, channel_id) references public.channels (office_id, id) on delete cascade,
  foreign key (office_id, topic_id) references public.topics (office_id, id) on delete set null (topic_id),
  foreign key (office_id, device_id) references public.devices (office_id, id) on delete set null (device_id),
  constraint preview_has_expiry check ((preview_path is null) = (preview_expires_at is null))
);
create index contents_channel on public.contents (channel_id, created_at desc);
create index contents_office_stage on public.contents (office_id, stage);
create index contents_topic on public.contents (topic_id);
create index contents_device on public.contents (device_id);
create index contents_scheduled on public.contents (scheduled_at) where stage = 'scheduled';
create index contents_preview_expiry on public.contents (preview_expires_at) where preview_path is not null;

alter table public.task_runs
  add constraint task_runs_content_fk foreign key (office_id, content_id)
  references public.contents (office_id, id) on delete set null (content_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  content_id uuid not null,
  stage text not null check (stage in ('script','video')),
  revision int not null check (revision >= 0),
  source_run_id uuid,                               -- run yang menghasilkan hal yang direview
  decision text check (decision in ('approve','revise','reject')),   -- null = menunggu kamu
  note text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (office_id, content_id) references public.contents (office_id, id) on delete cascade,
  foreign key (office_id, source_run_id)
    references public.task_runs (office_id, id) on delete set null (source_run_id),
  constraint decided_complete check ((decision is null) = (decided_at is null)),
  constraint revise_needs_note check (decision is distinct from 'revise' or length(trim(coalesce(note,''))) > 0)
);
create unique index approvals_one_pending on public.approvals (content_id, stage) where decision is null;
create unique index approvals_per_revision on public.approvals (content_id, stage, revision);
create index approvals_inbox on public.approvals (office_id, created_at desc) where decision is null;
create index approvals_source_run on public.approvals (source_run_id);
create index approvals_decided_by on public.approvals (decided_by);

-- -----------------------------------------------------------------------------
-- CS WhatsApp (Fase 3)
-- -----------------------------------------------------------------------------

create table public.business_infos (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null default '' check (length(body) <= 20000),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_infos_office on public.business_infos (office_id, position);

create table public.wa_connections (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null unique,
  display_phone text not null,
  agent_id uuid,                                    -- agent CS yang membalas
  access_token_secret_id uuid,                      -- id di Supabase Vault; token tidak disimpan di tabel
  status text not null default 'pending' check (status in ('pending','active','disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  foreign key (office_id, agent_id) references public.agents (office_id, id) on delete set null (agent_id)
);
create index wa_connections_office on public.wa_connections (office_id);
create index wa_connections_agent on public.wa_connections (agent_id);

create table public.cs_conversations (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  wa_connection_id uuid not null,
  customer_wa_id text not null,
  customer_name text,
  handled_by text not null default 'agent' check (handled_by in ('agent','human')),
  last_message_at timestamptz not null default now(),
  last_customer_message_at timestamptz,             -- jendela 24 jam WhatsApp
  unread_count int not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (office_id, id),
  unique (wa_connection_id, customer_wa_id),
  foreign key (office_id, wa_connection_id) references public.wa_connections (office_id, id) on delete cascade
);
create index cs_conversations_inbox on public.cs_conversations (office_id, last_message_at desc);

create table public.cs_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  conversation_id uuid not null,
  direction text not null check (direction in ('in','out')),
  wa_message_id text unique,                        -- idempotensi webhook
  body text,
  media jsonb check (media is null or jsonb_typeof(media) = 'object'),
  status text not null default 'received'
    check (status in ('received','queued','sent','delivered','read','failed')),
  sent_by text not null check (sent_by in ('customer','agent','human')),
  run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (office_id, conversation_id) references public.cs_conversations (office_id, id) on delete cascade,
  foreign key (office_id, run_id) references public.task_runs (office_id, id) on delete set null (run_id),
  constraint direction_matches_sender check ((direction = 'in') = (sent_by = 'customer'))
);
create index cs_messages_conversation on public.cs_messages (conversation_id, created_at);
create index cs_messages_office on public.cs_messages (office_id);
create index cs_messages_run on public.cs_messages (run_id);

-- -----------------------------------------------------------------------------
-- Asisten, aktivitas, notifikasi
-- -----------------------------------------------------------------------------

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text not null check (role in ('user','assistant','tool')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_messages_office on public.assistant_messages (office_id, created_at);
create index assistant_messages_user on public.assistant_messages (user_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id) on delete cascade,
  agent_id uuid,
  kind text not null,                               -- 'run.succeeded', 'approval.requested', 'device.online', ...
  text text not null,                               -- "Rina selesai meriset 3 topik"
  object_type text,
  object_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (office_id, agent_id) references public.agents (office_id, id) on delete set null (agent_id)
);
create index activity_events_feed on public.activity_events (office_id, created_at desc);
create index activity_events_agent on public.activity_events (agent_id);

create table public.push_subscriptions (           -- Web Push (Fase 2)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

-- updated_at otomatis di semua tabel
do $$
declare t text;
begin
  foreach t in array array[
    'platform_admins','reserved_slugs','offices','orders','payment_events','office_members',
    'devices','device_secrets','setup_codes','agents','skills','agent_skills','video_templates',
    'channels','channel_template_versions','social_accounts','channel_accounts','tasks','task_runs',
    'topics','contents','approvals','business_infos','wa_connections','cs_conversations',
    'cs_messages','assistant_messages','activity_events','push_subscriptions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =============================================================================
-- Fungsi: jadwal, antrean, persetujuan
-- =============================================================================

-- Waktu berikutnya > p_after dari daftar jam lokal + hari (ISO) di zona p_tz.
create or replace function public.next_run_after(
  p_times time[], p_days smallint[], p_tz text, p_after timestamptz
) returns timestamptz
language sql stable set search_path = '' as $$
  select min((d::date + t) at time zone p_tz)
  from generate_series(
         ((p_after at time zone p_tz)::date)::timestamp,
         ((p_after at time zone p_tz)::date + 8)::timestamp,
         interval '1 day') as d
  cross join unnest(p_times) as t
  where extract(isodow from d)::smallint = any (p_days)
    and ((d::date + t) at time zone p_tz) > p_after;
$$;

create or replace function public.tasks_set_next_run() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_tz text;
begin
  if new.trigger = 'schedule' and new.enabled then
    select o.timezone into v_tz from public.offices o where o.id = new.office_id;
    new.next_run_at := public.next_run_after(new.schedule_times, new.schedule_days, v_tz, now());
  else
    new.next_run_at := null;
  end if;
  return new;
end $$;

create trigger tasks_set_next_run
  before insert or update of trigger, enabled, schedule_times, schedule_days on public.tasks
  for each row execute function public.tasks_set_next_run();

-- Rantai "setelah agent lain selesai" tidak boleh melingkar.
create or replace function public.tasks_no_cycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.after_task_id is null then
    return new;
  end if;
  if exists (
    with recursive chain (id, depth) as (
      select new.after_task_id, 1
      union all
      select t.after_task_id, c.depth + 1
      from public.tasks t join chain c on t.id = c.id
      where t.after_task_id is not null and c.depth < 50
    )
    select 1 from chain where chain.id = new.id
  ) then
    raise exception 'Rantai tugas tidak boleh melingkar' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger tasks_no_cycle
  before insert or update of after_task_id on public.tasks
  for each row execute function public.tasks_no_cycle();

-- pg_cron tiap menit: buat task_run untuk jadwal yang jatuh tempo.
-- Slot yang terlewat (server/kantor mati berhari-hari) hanya dibuat satu kali, lalu lompat ke slot berikutnya.
create or replace function public.enqueue_due_tasks() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select t.id, t.office_id, t.agent_id, t.channel_id, t.priority, t.required_capability,
           t.next_run_at, t.schedule_times, t.schedule_days, o.timezone
    from public.tasks t
    join public.offices o on o.id = t.office_id
    join public.agents a on a.id = t.agent_id
    where t.enabled and t.trigger = 'schedule' and t.next_run_at <= now()
      and o.status = 'active' and a.archived_at is null
    for update of t skip locked
  loop
    insert into public.task_runs
      (office_id, task_id, agent_id, channel_id, trigger_source, scheduled_for, priority, required_capability)
    values
      (r.office_id, r.id, r.agent_id, r.channel_id, 'schedule', r.next_run_at, r.priority, r.required_capability)
    on conflict (task_id, scheduled_for) where scheduled_for is not null do nothing;

    update public.tasks
       set next_run_at = public.next_run_after(r.schedule_times, r.schedule_days, r.timezone,
                                               greatest(now(), r.next_run_at))
     where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Mode hemat aktif? 'on' selalu; 'auto' bila biaya bulan ini >= 80% anggaran AI.
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
    ) >= o.ai_budget_cents * 10000 * 0.8                 -- 1 sen = 10.000 mikro-dolar
  end
  from public.offices o
  where o.id = p_office;
$$;

-- Dipanggil route POST /api/device/runs/claim (koneksi service, setelah token perangkat dicek).
-- Dua perangkat (PC + VPS) tidak bisa mengambil run yang sama: FOR UPDATE SKIP LOCKED.
create or replace function public.claim_task_run(p_device_id uuid, p_lease interval default interval '15 minutes')
returns setof public.task_runs
language plpgsql security definer set search_path = '' as $$
declare
  d public.devices;
  r public.task_runs;
  v_saver boolean;
begin
  select * into d from public.devices where id = p_device_id and status <> 'revoked';
  if not found then
    raise exception 'Perangkat tidak dikenal atau dicabut' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.offices o where o.id = d.office_id and o.status = 'active') then
    return;
  end if;
  v_saver := public.office_saver_active(d.office_id);

  loop
    select * into r
    from public.task_runs q
    where q.office_id = d.office_id
      and q.status = 'queued'
      and q.required_capability = any (d.capabilities)
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

-- pg_cron tiap menit: run yang lease-nya habis (PC mati di tengah jalan) dikembalikan ke antrean.
create or replace function public.requeue_expired_leases() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.task_runs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         error = case when attempts >= max_attempts then coalesce(error, 'Perangkat berhenti merespons') else error end,
         finished_at = case when attempts >= max_attempts then now() else null end,
         device_id = case when attempts >= max_attempts then device_id else null end,
         lease_expires_at = null
   where status in ('claimed','running') and lease_expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.mark_devices_offline() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.devices
     set status = 'offline'
   where status = 'online' and (last_seen_at is null or last_seen_at < now() - interval '3 minutes');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.expire_pending_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.orders set status = 'expired'
   where status = 'pending' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Kebijakan privasi: data kerja dihapus <= 30 hari setelah kantor ditutup. Orders tetap (office_id jadi null).
create or replace function public.purge_closed_offices() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.offices where status = 'closed' and closed_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- Setujui / Revisi / Tolak. Dipanggil dari browser lewat RPC (session user, RLS lewat is_office_member).
-- Atomik: klik dobel atau dua HP sekaligus -> hanya satu keputusan yang tercatat.
create or replace function public.decide_approval(p_approval_id uuid, p_decision text, p_note text default null)
returns public.approvals
language plpgsql security definer set search_path = '' as $$
declare
  a public.approvals;
  c public.contents;
  v_source_task uuid;
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
    -- lanjutkan rantai: tugas yang menunggu tugas pembuat konten ini
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

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.platform_admins enable row level security;            -- tanpa policy: server saja
alter table public.reserved_slugs enable row level security;             -- tanpa policy: server saja
alter table public.offices enable row level security;
alter table public.orders enable row level security;
alter table public.payment_events enable row level security;             -- tanpa policy: server saja
alter table public.office_members enable row level security;
alter table public.devices enable row level security;
alter table public.device_secrets enable row level security;
alter table public.setup_codes enable row level security;                -- tanpa policy: server saja
alter table public.agents enable row level security;
alter table public.skills enable row level security;
alter table public.agent_skills enable row level security;
alter table public.video_templates enable row level security;
alter table public.channels enable row level security;
alter table public.channel_template_versions enable row level security;
alter table public.social_accounts enable row level security;
alter table public.channel_accounts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_runs enable row level security;
alter table public.topics enable row level security;
alter table public.contents enable row level security;
alter table public.approvals enable row level security;
alter table public.business_infos enable row level security;
alter table public.wa_connections enable row level security;
alter table public.cs_conversations enable row level security;
alter table public.cs_messages enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.activity_events enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  -- Konfigurasi yang diedit user langsung: anggota kantor boleh baca-tulis.
  foreach t in array array[
    'agents','skills','agent_skills','channels','channel_template_versions',
    'social_accounts','channel_accounts','tasks','business_infos','device_secrets'
  ] loop
    execute format(
      'create policy members_all on public.%I for all to authenticated
         using (public.is_office_member(office_id))
         with check (public.is_office_member(office_id))', t);
  end loop;

  -- Ditulis server/perangkat, dibaca anggota (termasuk lewat Realtime).
  foreach t in array array[
    'devices','task_runs','topics','contents','approvals','activity_events',
    'cs_conversations','cs_messages','assistant_messages','wa_connections'
  ] loop
    execute format(
      'create policy members_read on public.%I for select to authenticated
         using (public.is_office_member(office_id))', t);
  end loop;
end $$;

create policy members_read on public.offices for select to authenticated
  using (public.is_office_member(id));
create policy owners_update_settings on public.offices for update to authenticated
  using (public.is_office_owner(id)) with check (public.is_office_owner(id));
revoke update on public.offices from authenticated;
grant update (display_name, timezone, saver_mode, ai_budget_cents) on public.offices to authenticated;

create policy members_read on public.orders for select to authenticated
  using (office_id is not null and public.is_office_member(office_id));

create policy members_read on public.office_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_office_member(office_id));

create policy members_update_status on public.topics for update to authenticated
  using (public.is_office_member(office_id)) with check (public.is_office_member(office_id));
revoke update on public.topics from authenticated;
grant update (status) on public.topics to authenticated;

create policy members_rename on public.devices for update to authenticated
  using (public.is_office_member(office_id)) with check (public.is_office_member(office_id));
revoke update on public.devices from authenticated;
grant update (name) on public.devices to authenticated;

create policy members_write_own on public.assistant_messages for insert to authenticated
  with check (public.is_office_member(office_id) and user_id = (select auth.uid()) and role = 'user');

create policy anyone_signed_in_reads on public.video_templates for select to authenticated
  using (is_active);

create policy own_rows on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Fungsi internal tidak boleh dipanggil dari browser.
revoke execute on function public.enqueue_due_tasks() from public, anon, authenticated;
revoke execute on function public.claim_task_run(uuid, interval) from public, anon, authenticated;
revoke execute on function public.requeue_expired_leases() from public, anon, authenticated;
revoke execute on function public.mark_devices_offline() from public, anon, authenticated;
revoke execute on function public.expire_pending_orders() from public, anon, authenticated;
revoke execute on function public.purge_closed_offices() from public, anon, authenticated;
revoke execute on function public.decide_approval(uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;

-- =============================================================================
-- Realtime: dashboard berubah live tanpa refresh (RLS tetap berlaku)
-- =============================================================================

alter publication supabase_realtime add table
  public.activity_events, public.task_runs, public.contents, public.approvals,
  public.devices, public.agents, public.cs_messages, public.cs_conversations;

-- =============================================================================
-- Jadwal pg_cron (UTC)
-- =============================================================================

select cron.schedule('enqueue-due-tasks',      '* * * * *',    $$select public.enqueue_due_tasks()$$);
select cron.schedule('requeue-expired-leases', '* * * * *',    $$select public.requeue_expired_leases()$$);
select cron.schedule('mark-devices-offline',   '* * * * *',    $$select public.mark_devices_offline()$$);
select cron.schedule('expire-pending-orders',  '*/15 * * * *', $$select public.expire_pending_orders()$$);
select cron.schedule('purge-closed-offices',   '0 20 * * *',   $$select public.purge_closed_offices()$$);  -- 03.00 WIB

-- =============================================================================
-- Seed
-- =============================================================================

insert into public.reserved_slugs (slug) values
  ('www'),('admin'),('api'),('app'),('auth'),('mail'),('smtp'),('status'),('docs'),('help'),
  ('blog'),('dashboard'),('masuk'),('beli'),('support'),('cdn'),('static'),('assets'),
  ('connector'),('download'),('install'),('kantor'),('kantoraiku'),('test'),('demo')
on conflict do nothing;
