begin;
select plan(10);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','approval-a@ritmo.test','',now(),now(),now(),'{}','{}'),
('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','approval-b@ritmo.test','',now(),now(),now(),'{}','{}');
insert into public.content_plans(id,user_id,platform,title,format,status) values
('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','instagram','Plano A','reel','review');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
create temp table approval_fixture(payload jsonb);
insert into approval_fixture values ('{"objective":"Ensinar um movimento simples com segurança.","hooks":["Sua panturrilha pesa depois do treino?","Teste este movimento antes da corrida.","Um minuto para cuidar da recuperação."],"scenes":[{"order":1,"visual":"Criador aponta para a panturrilha","speech":"Sentiu a panturrilha pesada depois do treino?","duration_seconds":8},{"order":2,"visual":"Criador demonstra mobilidade na parede","speech":"Faça este movimento devagar e sem forçar a dor.","duration_seconds":10}],"capture_notes":["Grave em plano aberto e com boa luz."],"editing_notes":["Use cortes simples entre as demonstrações."],"caption":"Uma rotina curta para recuperação consciente.","cta":"Salve para testar depois do próximo treino.","hashtags":["#corrida"]}'::jsonb);
select ok(to_regprocedure('public.approve_content_version(uuid,jsonb,timestamptz,boolean,text)') is not null,'hardened approval exists');
select lives_ok($$select public.approve_content_version('aaaaaaaa-0000-4000-8000-000000000001',(select payload from approval_fixture),'2030-01-01 12:00+00',true,'approval:stable-key-1')$$,'valid approval succeeds');
select is((select count(*)::integer from public.content_versions),1,'success creates one version');
select is((select status from public.content_plans where id='aaaaaaaa-0000-4000-8000-000000000001'),'scheduled','success schedules plan');
select is((select count(*)::integer from public.ai_jobs),1,'success creates one memory job');
select throws_ok($$select public.approve_content_version('aaaaaaaa-0000-4000-8000-000000000001','{"objective":"bad"}'::jsonb,'2030-01-02 12:00+00',true,'approval:invalid-1')$$,'22023','invalid objective, caption or cta','invalid payload rejected');
select is((select count(*)::integer from public.content_versions),1,'invalid request writes nothing');
select lives_ok($$select public.approve_content_version('aaaaaaaa-0000-4000-8000-000000000001',(select payload from approval_fixture),'2030-01-01 12:00+00',true,'approval:stable-key-1')$$,'same request retries');
select is((select count(*)::integer from public.content_versions),1,'retry duplicates neither version nor schedule job');
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
select throws_ok($$select public.approve_content_version('aaaaaaaa-0000-4000-8000-000000000001',(select payload from approval_fixture),'2030-01-01 12:00+00',true,'approval:foreign-plan')$$,'P0002','content plan not found','creator isolation enforced');
select * from finish();
rollback;
