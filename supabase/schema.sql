-- ============================================================
-- Hair Day - Schema do banco (Supabase / PostgreSQL)
-- Rode este script no Supabase: SQL Editor > New query > Run
-- ============================================================

-- Tabela de clientes da barbearia.
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null,
  phone       text not null,
  created_at  timestamptz not null default now(),
  -- Um e-mail identifica um cliente (usado no upsert ao agendar).
  constraint clients_email_unique unique (email)
);

-- Assinatura: o admin marca/desmarca quem e assinante.
alter table public.clients
  add column if not exists is_subscriber boolean not null default false;

-- Tabela de agendamentos.
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  when_at     timestamptz not null,
  service_id  text,
  service_name text,
  service_price_cents integer,
  service_duration_minutes integer,
  barber_id   text,
  barber_name text,
  -- confirmed | cancelled
  status      text not null default 'confirmed'
              check (status in ('confirmed', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- Idempotente: adiciona os campos em bancos que ja existem.
alter table public.appointments
  add column if not exists service_id text,
  add column if not exists service_name text,
  add column if not exists service_price_cents integer,
  add column if not exists service_duration_minutes integer,
  add column if not exists barber_id text,
  add column if not exists barber_name text;

-- Impede conflito de agenda por profissional.
-- Enquanto houver apenas um barbeiro/sem preferencia, barber_id nulo continua
-- funcionando como a agenda unica atual. Com varios barbeiros, cada barber_id
-- pode ter a propria agenda no mesmo horario.
drop index if exists appointments_active_slot_unique;
create unique index if not exists appointments_active_slot_barber_unique
  on public.appointments (coalesce(barber_id, ''), when_at)
  where status = 'confirmed';

-- Acelera a busca por dia.
create index if not exists appointments_when_idx
  on public.appointments (when_at);

-- Acelera filtros futuros por barbeiro.
create index if not exists appointments_barber_when_idx
  on public.appointments (barber_id, when_at);

-- ============================================================
-- Row Level Security (RLS)
-- As Serverless Functions usam a chave service_role, que ignora o RLS.
-- Mantemos RLS ativo e sem politicas publicas para que o banco nao fique
-- exposto caso a chave anon seja usada no front-end.
-- ============================================================
alter table public.clients      enable row level security;
alter table public.appointments enable row level security;

-- ============================================================
-- Ao criar uma conta (sign-up), cria/atualiza o registro de cliente
-- a partir dos metadados (full_name, phone) enviados pelo front.
-- Assim o cliente ja aparece na lista do admin mesmo sem ter agendado.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clients (full_name, email, phone)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (email) do update set
    full_name = coalesce(nullif(excluded.full_name, ''), public.clients.full_name),
    phone     = coalesce(nullif(excluded.phone, ''), public.clients.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
