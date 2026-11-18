-- 0006: file uploads (syllabus PDFs first). See docs/07-architecture.md §11.
-- Files live in a PRIVATE Supabase Storage bucket, in a folder named after
-- your user id, so only you can read them. Free plan: 1 GB total.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-files', 'user-files', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- Storage rules: you can only touch files inside your own folder "<your id>/…".
create policy "own files: read" on storage.objects for select
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: upload" on storage.objects for insert
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: delete" on storage.objects for delete
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- What we know about each file. extracted_text is filled in by the browser
-- (pdf.js) right after upload, so Claude can read it through the connector.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  class_id uuid references public.classes on delete set null,
  kind text not null default 'syllabus',
  extracted_text text,
  status text not null default 'uploaded' check (status in ('uploaded', 'text_ready', 'needs_claude', 'imported')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.files enable row level security;
create policy "own rows" on public.files
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
