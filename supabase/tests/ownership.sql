-- Execute as postgres in SQL Editor. All fixtures are rolled back.
begin;

insert into auth.users(id, email, raw_user_meta_data) values
  ('a1000000-0000-4000-8000-000000000001', 'nuevamente-rls-a@example.invalid', '{"full_name":"RLS A"}'),
  ('b2000000-0000-4000-8000-000000000002', 'nuevamente-rls-b@example.invalid', '{"full_name":"RLS B"}');

insert into public.documents(id, user_id, title) values
  ('d1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Document A'),
  ('d2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Document B');
insert into public.learning_packages(id, user_id, document_id, title, payload) values
  ('e1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Package A', '{"contenido_adaptado":{"titulo":"A"}}'),
  ('e2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'Package B', '{"contenido_adaptado":{"titulo":"B"}}');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profiles RLS failed'; end if;
  if (select count(*) from public.user_state) <> 1 then raise exception 'User state RLS failed'; end if;
  if (select count(*) from public.documents) <> 1 then raise exception 'Documents RLS failed'; end if;
  if (select count(*) from public.learning_packages) <> 1 then raise exception 'Packages RLS failed'; end if;
  if (select display_name from public.profiles) <> 'RLS A' then raise exception 'Auth trigger failed'; end if;

  update public.documents set title = 'Forbidden' where user_id = 'b2000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user update succeeded'; end if;

  begin
    insert into public.documents(user_id, title) values ('b2000000-0000-4000-8000-000000000002', 'Spoofed owner');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.learning_packages(document_id, title, payload)
    values ('d2000000-0000-4000-8000-000000000002', 'Cross-user document', '{}');
    raise exception 'Cross-user document association succeeded';
  exception when foreign_key_violation then null;
  end;

  update public.user_state set xp = 100, achievements = '[{"id":"ninja","desbloqueado":true}]'
  where user_id = 'a1000000-0000-4000-8000-000000000001';
  insert into public.learning_progress(package_id, current_step, completed_stations, quiz_answers)
  values ('e1000000-0000-4000-8000-000000000001', 2, '{"0":true}', '{"question1":"a"}');
  if (select xp from public.user_state) <> 100 then raise exception 'XP persistence failed'; end if;
  if (select current_step from public.learning_progress) <> 2 then raise exception 'Progress persistence failed'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'b2000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select title from public.documents) <> 'Document B' then raise exception 'Second owner isolation failed'; end if;
  if (select xp from public.user_state) <> 0 then raise exception 'Second owner state isolation failed'; end if;
  if exists(select 1 from public.learning_progress) then raise exception 'Progress leaked to second owner'; end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.documents;
    raise exception 'Anonymous read succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;

select 'PASS: auth trigger, own-data persistence, two-user isolation, anonymous denial; fixtures rolled back' as verification;
