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

-- Assinatura: o admin marca/desmarca quem é assinante (direito a 1 corte/semana).
-- Idempotente: pode rodar de novo num banco já existente sem erro.
alter table public.clients
  add column if not exists is_subscriber boolean not null default false;

-- Tabela de agendamentos.
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  when_at     timestamptz not null,
  -- confirmed | cancelled
  status      text not null default 'confirmed'
              check (status in ('confirmed', 'cancelled')),
  created_at  timestamptz not null default now()
);

-- Impede DOIS agendamentos ativos no mesmo horário (checagem atômica no banco).
-- Agendamentos cancelados liberam o horário.
create unique index if not exists appointments_active_slot_unique
  on public.appointments (when_at)
  where status = 'confirmed';

-- Acelera a busca por dia.
create index if not exists appointments_when_idx
  on public.appointments (when_at);

-- ============================================================
-- Row Level Security (RLS)
-- As Serverless Functions usam a chave service_role, que IGNORA o RLS.
-- Mantemos RLS ativo e SEM políticas públicas para que o banco não fique
-- exposto caso a chave anon seja usada no front-end (Fase 3 adiciona as
-- políticas por usuário autenticado).
-- ============================================================
alter table public.clients      enable row level security;
alter table public.appointments enable row level security;
