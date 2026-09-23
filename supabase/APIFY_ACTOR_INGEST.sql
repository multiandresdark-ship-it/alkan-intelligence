create table public.apify_actor_bindings (
 client_id text not null, actor_id text not null, kind text not null check(kind in ('serp','digital','accela')),
 label text not null, enabled boolean not null default true, primary key(client_id,actor_id)
);
alter table public.apify_actor_bindings enable row level security;
revoke all on public.apify_actor_bindings from public,anon,authenticated;
grant select on public.apify_actor_bindings to authenticated;
grant all on public.apify_actor_bindings to service_role;
create policy apify_bindings_own on public.apify_actor_bindings for select to authenticated using(client_id=public.get_my_client_id());
insert into public.apify_actor_bindings(client_id,actor_id,kind,label) values
('alkan','TjhMWf7k2yBWa9cxz','serp','Construction Subcontractor Leads (SERP + IA)'),
('alkan','ARWSQq6yrTyaMbDND','digital','Alkan - Perfil Digital'),
('alkan','mbyWbXzahJnDWasbB','accela','Alkan - Accela Seattle (legacy)');
create table private.apify_entities (
 client_id text not null, kind text not null, identity text not null, lead_id uuid not null references public.leads(id) on delete cascade,
 observed_at timestamptz, primary key(client_id,kind,identity)
);
create table private.apify_import_items (
 client_id text not null, actor_id text not null, run_id text not null, item_index integer not null,
 lead_id uuid references public.leads(id) on delete set null, imported_at timestamptz not null default now(),
 primary key(client_id,actor_id,run_id,item_index)
);
alter table private.apify_entities enable row level security;
alter table private.apify_import_items enable row level security;
revoke all on private.apify_entities,private.apify_import_items from public,anon,authenticated;
grant all on private.apify_entities,private.apify_import_items to service_role;
create or replace function public.ingest_apify_record(p_client_id text,p_actor_id text,p_run_id text,p_item_index integer,p_observed_at timestamptz,p_record jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare k text; ident text; lid uuid; found_ids uuid[]; old_observed timestamptz; prior public.leads; merged jsonb; new_row boolean:=false;
begin
 select kind into k from public.apify_actor_bindings where client_id=p_client_id and actor_id=p_actor_id and enabled;
 if k is null then raise exception 'Actor is not assigned to this workspace'; end if;
 if p_run_id !~ '^[a-zA-Z0-9]{10,40}$' or p_item_index<0 or p_item_index>1000000 then raise exception 'Invalid run reference'; end if;
 if jsonb_typeof(p_record) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_record) x where x not in ('identity','company','name','permit_number','jurisdiction','city','trade','phone','email','website','lead_id','evidence'))
 or jsonb_typeof(p_record->'evidence') is distinct from 'object' then raise exception 'Invalid source record'; end if;
 ident=p_record->>'identity';
 if ident is null or length(ident)<3 or length(ident)>2600 or octet_length(p_record::text)>32000 then raise exception 'Invalid identity or oversized record'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_id||':'||k||':'||ident,0));
 select lead_id into lid from private.apify_import_items where client_id=p_client_id and actor_id=p_actor_id and run_id=p_run_id and item_index=p_item_index;
 if found then return jsonb_build_object('result','already_imported','lead_id',lid); end if;
 select lead_id,observed_at into lid,old_observed from private.apify_entities where client_id=p_client_id and kind=k and identity=ident;
 if lid is null and k='digital' then
   if p_record->>'lead_id' is not null then
     select id into lid from public.leads where id=(p_record->>'lead_id')::uuid and client_id=p_client_id;
   else
     select array_agg(id) into found_ids from public.leads where client_id=p_client_id and lower(btrim(company))=lower(btrim(p_record->>'company'));
     if cardinality(found_ids)=1 then lid=found_ids[1]; end if;
   end if;
   if lid is null then return jsonb_build_object('result','unmatched','reason','Digital result needs one matching business in this workspace'); end if;
 end if;
 if lid is null and k='accela' then
   select array_agg(id) into found_ids from public.leads where client_id=p_client_id and permit_number=p_record->>'permit_number' and jurisdiction='seattle';
   if cardinality(found_ids)=1 then lid=found_ids[1]; end if;
   if cardinality(found_ids)>1 then return jsonb_build_object('result','ambiguous'); end if;
 end if;
 if old_observed is not null and (p_observed_at is null or p_observed_at<old_observed) then return jsonb_build_object('result','stale','lead_id',lid); end if;
 if lid is null then
   insert into public.leads(client_id,company,name,source,status,permit_number,jurisdiction,enrichment_data)
   values(p_client_id,nullif(p_record->>'company',''),nullif(p_record->>'name',''),'apify_'||k,'new',nullif(p_record->>'permit_number',''),nullif(p_record->>'jurisdiction',''),'{}') returning id into lid;
   new_row=true;
 end if;
 select * into prior from public.leads where id=lid and client_id=p_client_id for update;
 if not found then raise exception 'Lead workspace mismatch'; end if;
 merged=coalesce(prior.enrichment_data,'{}'::jsonb);
 merged=merged||jsonb_build_object('apify',coalesce(merged->'apify','{}'::jsonb)||jsonb_build_object(k,p_record->'evidence'));
 if merged->>'city' is null and p_record->>'city' is not null then merged=merged||jsonb_build_object('city',p_record->>'city'); end if;
 if merged->>'trade' is null and p_record->>'trade' is not null then merged=merged||jsonb_build_object('trade',p_record->>'trade'); end if;
 if merged->>'website' is null and p_record->>'website' is not null then merged=merged||jsonb_build_object('website',p_record->>'website'); end if;
 update public.leads set enrichment_data=merged,updated_at=now() where id=lid and client_id=p_client_id;
 insert into private.apify_entities(client_id,kind,identity,lead_id,observed_at) values(p_client_id,k,ident,lid,p_observed_at)
 on conflict(client_id,kind,identity) do update set observed_at=excluded.observed_at;
 insert into private.apify_import_items(client_id,actor_id,run_id,item_index,lead_id) values(p_client_id,p_actor_id,p_run_id,p_item_index,lid);
 return jsonb_build_object('result',case when new_row then 'inserted' else 'updated' end,'lead_id',lid);
end; $$;
revoke all on function public.ingest_apify_record(text,text,text,integer,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_apify_record(text,text,text,integer,timestamptz,jsonb) to service_role;
