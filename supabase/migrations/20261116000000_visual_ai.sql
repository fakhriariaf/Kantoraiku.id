-- Visual video per channel: gambar AI (fal FLUX / OpenAI) yang digerakkan FFmpeg, footage stok, atau latar polos.
-- auto = gambar AI fal bila kuncinya ada, lalu stok Pexels, lalu latar polos (tidak memakai kunci OpenAI
-- otomatis karena kunci itu juga dipakai otak agent; biaya gambar OpenAI harus dipilih sendiri).
alter table public.channels
  add column video_visual text not null default 'auto'
    check (video_visual in ('auto', 'ai_fal', 'ai_openai', 'stock', 'plain')),
  add column visual_style text not null default ''
    check (length(visual_style) <= 300);

-- Kunci fal.ai (gambar AI) juga bisa diisi dari dashboard dan dienkripsi untuk PC.
alter table public.device_secrets drop constraint device_secrets_kind_check;
alter table public.device_secrets add constraint device_secrets_kind_check
  check (kind in ('anthropic_api_key', 'openai_api_key', 'elevenlabs_api_key', 'pexels_api_key', 'fal_api_key', 'repliz_api_key'));
