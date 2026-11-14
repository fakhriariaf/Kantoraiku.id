-- Kunci Pexels (footage video) juga bisa diisi dari dashboard dan dienkripsi untuk PC.
alter table public.device_secrets drop constraint device_secrets_kind_check;
alter table public.device_secrets add constraint device_secrets_kind_check
  check (kind in ('anthropic_api_key', 'openai_api_key', 'elevenlabs_api_key', 'pexels_api_key', 'repliz_api_key'));
-- Ciphertext v1 (lihat packages/shared: sealSecret) tidak lebih dari beberapa KB.
alter table public.device_secrets add constraint device_secrets_ciphertext_size check (length(ciphertext) <= 8000);
