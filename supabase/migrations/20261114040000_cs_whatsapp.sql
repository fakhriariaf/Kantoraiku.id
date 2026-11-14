-- CS WhatsApp (Fase 3, iterasi 1).
-- Koneksi "simulation": pemilik mengetik sebagai pelanggan di dashboard untuk mencoba agent CS tanpa WhatsApp.
-- Koneksi "cloud": nomor WhatsApp Business lewat Cloud API resmi (didaftarkan lewat Embedded Signup, menyusul).

alter table public.wa_connections
  add column mode text not null default 'cloud' check (mode in ('cloud', 'simulation'));
create unique index wa_connections_one_simulation on public.wa_connections (office_id) where mode = 'simulation';

-- Alasan pesan keluar gagal terkirim (mis. di luar jendela 24 jam WhatsApp).
alter table public.cs_messages add column error text;
create index if not exists cs_messages_conversation on public.cs_messages (conversation_id, created_at);
create index if not exists cs_conversations_office on public.cs_conversations (office_id, last_message_at desc);

-- Satu tugas "balas WhatsApp" per agent CS; run-nya dibuat saat pesan masuk.
create unique index tasks_one_cs_reply_per_agent on public.tasks (agent_id) where kind = 'cs_reply';
