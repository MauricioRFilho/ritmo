begin;

select plan(11);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit_events has RLS enabled'
);

select policies_are(
  'public', 'audit_events',
  array['audit_events_owner_insert', 'audit_events_owner_read'],
  'audit_events exposes only append and owner-read policies'
);

select ok(
  exists(select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'account_mode'),
  'account mode exists'
);

select ok(
  exists(select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'creator_preferences'
      and column_name = 'niche_id'),
  'niche taxonomy exists'
);

select ok(
  to_regprocedure('public.requeue_stale_ai_jobs(interval)') is not null,
  'stale-job recovery function exists'
);

select ok(
  to_regclass('public.audit_events_user_id_idx') is not null,
  'audit events owner lookup is indexed'
);

select ok(
  to_regclass('public.creator_preferences_user_category_idx') is not null,
  'preferences have one value per category'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.requeue_stale_ai_jobs(interval)', 'EXECUTE'
  ),
  'authenticated users cannot recover global jobs'
);

select ok(
  to_regprocedure('public.claim_privacy_deletion(text)') is not null,
  'privacy deletion claim function exists'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.claim_privacy_deletion(text)', 'EXECUTE'
  ),
  'authenticated users cannot claim deletion requests'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.requeue_stale_privacy_deletions(interval)',
    'EXECUTE'
  ),
  'authenticated users cannot recover deletion requests'
);

select * from finish();
rollback;
