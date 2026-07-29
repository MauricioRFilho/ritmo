begin;

select plan(3);

select ok(
  to_regprocedure('public.approve_content_version(uuid,jsonb,timestamptz,boolean)') is not null,
  'atomic creative approval function exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.approve_content_version(uuid,jsonb,timestamptz,boolean)',
    'EXECUTE'
  ),
  'authenticated creators can approve their own content version'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.approve_content_version(uuid,jsonb,timestamptz,boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot approve content versions'
);

select * from finish();
rollback;
