-- =============================================================================
-- Devis Scan — stockage des fichiers.
--
-- company-assets (public en lecture) : logos des entreprises, affichés sur les
--   pages client et les devis. Chemin : {company_id}/logo-{horodatage}.{ext}
-- request-media (PRIVÉ) : vidéos et images extraites.
--   Chemin : {company_id}/{request_id}/videos/{video_id}.{ext}
--            {company_id}/{request_id}/frames/{frame_id}.jpg
--   Lecture : membres de l'entreprise, via des URL signées temporaires.
--   Écriture : uniquement le serveur (clé secrète) ou des URL d'envoi signées
--   qu'il délivre après contrôle. Aucun envoi direct par un utilisateur.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('company-assets', 'company-assets', true, 2 * 1024 * 1024,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('request-media', 'request-media', false, 50 * 1024 * 1024,
   array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Premier dossier du chemin converti en identifiant d'entreprise (null si invalide).
create or replace function private.path_company_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  if first_segment ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end;
$$;

grant execute on function private.path_company_id(text) to authenticated, service_role;

-- Logos : gérés par owner et admin, dans le dossier de leur entreprise.
create policy "company-assets: ajout par owner et admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and private.path_company_id(name) in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[]))
  );

create policy "company-assets: modification par owner et admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'company-assets'
    and private.path_company_id(name) in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[]))
  )
  with check (
    bucket_id = 'company-assets'
    and private.path_company_id(name) in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[]))
  );

create policy "company-assets: suppression par owner et admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-assets'
    and private.path_company_id(name) in (select private.user_company_ids_with_role(array['owner', 'admin']::public.member_role[]))
  );

-- Lister ses propres fichiers (la lecture publique des logos se fait par URL publique).
create policy "company-assets: lecture par les membres"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'company-assets'
    and private.path_company_id(name) in (select private.user_company_ids())
  );

-- Vidéos et images : lecture seule par les membres de l'entreprise concernée.
create policy "request-media: lecture par les membres"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'request-media'
    and private.path_company_id(name) in (select private.user_company_ids())
  );
