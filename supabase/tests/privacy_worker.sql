begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'privacy@ritmo.test', '',
  now(), now(), now(), '{}'::jsonb, '{}'::jsonb
);

insert into public.privacy_requests (user_id, request_type)
values ('33333333-3333-4333-8333-333333333333', 'deletion');

select is(
  (select status from public.privacy_requests limit 1),
  'requested',
  'deletion starts requested'
);

select is(
  (select count(*)::integer from public.claim_privacy_deletion('test-worker')),
  1,
  'worker claims one deletion'
);

select is(
  (select status from public.privacy_requests limit 1),
  'processing',
  'claimed deletion enters processing'
);

select is(
  (select attempts from public.privacy_requests limit 1),
  1,
  'claim increments attempts'
);

update public.privacy_requests
set locked_at = now() - interval '20 minutes';

select is(
  public.requeue_stale_privacy_deletions(interval '15 minutes'),
  1,
  'stale deletion returns to queue'
);

select * from finish();
rollback;
