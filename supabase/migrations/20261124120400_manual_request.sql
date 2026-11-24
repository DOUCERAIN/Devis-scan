-- =============================================================================
-- Devis Scan — création manuelle d'une demande par un déménageur
-- (demande reçue par téléphone, par e-mail ou en agence).
--
-- Fonction « security invoker » : elle s'exécute avec les droits de
-- l'utilisateur, donc toutes les règles RLS s'appliquent. Elle regroupe
-- les insertions (client, demande, logements) en une seule transaction.
-- L'entreprise est celle de l'utilisateur : elle n'est jamais fournie par le navigateur.
-- =============================================================================

create or replace function public.create_manual_request(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target_company uuid;
  new_customer uuid;
  new_request uuid;
  kind text;
  d jsonb;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select company_id into target_company
  from public.company_members
  where user_id = uid
  order by created_at
  limit 1;
  if target_company is null then
    raise exception 'User has no company' using errcode = '42501';
  end if;

  insert into public.customers (company_id, full_name, email, phone)
  values (
    target_company,
    payload #>> '{customer,full_name}',
    nullif(payload #>> '{customer,email}', ''),
    nullif(payload #>> '{customer,phone}', '')
  )
  returning id into new_customer;

  insert into public.quote_requests (company_id, customer_id, status, source, moving_date, moving_date_flexible,
                                     customer_notes, submitted_at)
  values (
    target_company,
    new_customer,
    'submitted',
    'mover_manual',
    nullif(payload ->> 'moving_date', '')::date,
    coalesce((payload ->> 'moving_date_flexible')::boolean, false),
    nullif(payload ->> 'customer_notes', ''),
    now()
  )
  returning id into new_request;

  foreach kind in array array['origin', 'destination'] loop
    d := payload -> kind;
    if d is not null and jsonb_typeof(d) = 'object' then
      insert into public.dwellings (request_id, company_id, kind, address_line, postal_code, city, housing_type,
                                    floor, elevator, carrying_distance_m, access_notes)
      values (
        new_request,
        target_company,
        kind::public.dwelling_kind,
        nullif(d ->> 'address_line', ''),
        nullif(d ->> 'postal_code', ''),
        nullif(d ->> 'city', ''),
        nullif(d ->> 'housing_type', '')::public.housing_type,
        nullif(d ->> 'floor', '')::integer,
        nullif(d ->> 'elevator', '')::public.elevator_type,
        nullif(d ->> 'carrying_distance_m', '')::integer,
        nullif(d ->> 'access_notes', '')
      );
    end if;
  end loop;

  return new_request;
end;
$$;

revoke all on function public.create_manual_request(jsonb) from public, anon;
grant execute on function public.create_manual_request(jsonb) to authenticated;
