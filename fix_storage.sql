-- Run these commands in your Supabase SQL Editor to fix the Storage Bucket issues

-- 1. Ensure the buckets exist (just in case)
insert into storage.buckets (id, name, public) 
values 
  ('submissions', 'submissions', true),
  ('rubrics', 'rubrics', true)
on conflict (id) do nothing;

-- 2. Allow ANYONE to upload and read from the 'submissions' bucket
create policy "Public Access Submissions"
  on storage.objects for select
  using ( bucket_id = 'submissions' );

create policy "Public Insert Submissions"
  on storage.objects for insert
  with check ( bucket_id = 'submissions' );

-- 3. Allow ANYONE to upload and read from the 'rubrics' bucket
create policy "Public Access Rubrics"
  on storage.objects for select
  using ( bucket_id = 'rubrics' );

create policy "Public Insert Rubrics"
  on storage.objects for insert
  with check ( bucket_id = 'rubrics' );
