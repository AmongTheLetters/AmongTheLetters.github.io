-- Private bucket for the founding (lifetime) member library: the guide PDFs and tracker files.
-- No storage policies on purpose. Only the service role reaches it, through the `founding-downloads`
-- Edge Function, which checks for an active lifetime membership and hands out short-lived signed links.
-- Upload the files with the CLI, see LAUNCH_CHECKLIST.md. Safe to run more than once.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('founding-downloads', 'founding-downloads', false, 20971520,
        array['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
