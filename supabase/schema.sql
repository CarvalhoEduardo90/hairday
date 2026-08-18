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

-- Catalogo de servicos oferecidos.
create table if not exists public.services (
  id          text primary key,
  name        text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Profissionais da barbearia.
create table if not exists public.barbers (
  id          text primary key,
  name        text not null,
  phone       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Horario semanal de funcionamento.
create table if not exists public.business_hours (
  day_of_week integer primary key check (day_of_week between 0 and 6),
  opens_at    time not null default '09:00',
  closes_at   time not null default '18:00',
  slot_interval_minutes integer not null default 60 check (slot_interval_minutes > 0),
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  check (opens_at < closes_at)
);

-- Pausas recorrentes, como almoco.
create table if not exists public.business_breaks (
  id          uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  starts_at   time not null,
  ends_at     time not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at)
);

-- Bloqueios pontuais para ausencias, feriados ou manutencao.
create table if not exists public.schedule_blocks (
  id          uuid primary key default gen_random_uuid(),
  block_date  date not null,
  starts_at   time not null,
  ends_at     time not null,
  barber_id   text references public.barbers (id) on delete set null,
  reason      text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (starts_at < ends_at)
);

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

-- Protege contra sobreposicao de atendimentos com duracoes diferentes.
-- Em bancos ja populados, revise conflitos existentes antes de aplicar esta
-- constraint, porque o Postgres rejeita a criacao se houver sobreposicao.
create extension if not exists btree_gist with schema extensions;

-- O Postgres exige que toda funcao usada numa expressao de indice/constraint
-- seja IMMUTABLE. A expressao tstzrange(...) + make_interval(...) nao e aceita
-- inline, entao encapsulamos o calculo numa funcao marcada como immutable.
-- O calculo e deterministico (timestamptz + interval), entao a marcacao e correta.
create or replace function public.appointment_slot_range(
  when_at timestamptz,
  duration_minutes integer
)
returns tstzrange
language sql
immutable
as $$
  select tstzrange(
    when_at,
    when_at + make_interval(mins => coalesce(nullif(duration_minutes, 0), 60)),
    '[)'
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_active_barber_overlap_excl'
  ) then
    alter table public.appointments
      add constraint appointments_active_barber_overlap_excl
      exclude using gist (
        coalesce(barber_id, '') with =,
        public.appointment_slot_range(when_at, service_duration_minutes) with &&
      )
      where (status = 'confirmed');
  end if;
end $$;

-- Sementes iniciais, seguras para rodar de novo.
insert into public.services (id, name, price_cents, duration_minutes, active)
values
  ('corte-social', 'Corte social', 3500, 40, true),
  ('barba', 'Barba', 2500, 30, true),
  ('corte-barba', 'Corte + barba', 5500, 60, true),
  ('hidratacao', 'Hidratacao', 4500, 45, true),
  ('botox', 'Botox capilar', 9000, 90, true)
on conflict (id) do nothing;

insert into public.barbers (id, name, phone, active)
values
  ('barbeiro-joao', 'Joao', '', true),
  ('barbeiro-marcos', 'Marcos', '', true)
on conflict (id) do nothing;

insert into public.business_hours
  (day_of_week, opens_at, closes_at, slot_interval_minutes, active)
values
  (0, '09:00', '12:00', 60, false),
  (1, '09:00', '18:00', 60, true),
  (2, '09:00', '18:00', 60, true),
  (3, '09:00', '18:00', 60, true),
  (4, '09:00', '18:00', 60, true),
  (5, '09:00', '18:00', 60, true),
  (6, '09:00', '14:00', 60, true)
on conflict (day_of_week) do nothing;

insert into public.business_breaks (day_of_week, starts_at, ends_at, active)
select day_of_week, '12:00'::time, '13:00'::time, true
from generate_series(1, 5) as days(day_of_week)
where not exists (
  select 1
  from public.business_breaks b
  where b.day_of_week = days.day_of_week
    and b.starts_at = '12:00'::time
    and b.ends_at = '13:00'::time
);

-- ============================================================
-- Row Level Security (RLS)
-- As Serverless Functions usam a chave service_role, que ignora o RLS.
-- Mantemos RLS ativo e sem politicas publicas para que o banco nao fique
-- exposto caso a chave anon seja usada no front-end.
-- ============================================================
alter table public.clients      enable row level security;
alter table public.appointments enable row level security;
alter table public.services     enable row level security;
alter table public.barbers      enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_breaks enable row level security;
alter table public.schedule_blocks enable row level security;

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

-- ============================================================
-- Perfis de acesso (admin / scheduler / client).
-- O vinculo e por e-mail, igual ao resto do sistema.
-- Quem nao estiver aqui e tratado como 'client'.
-- ADMIN_EMAILS (variavel de ambiente) tem precedencia sobre esta tabela:
-- e o bootstrap que garante acesso ao painel mesmo com a tabela vazia.
-- ============================================================
create table if not exists public.user_roles (
  email      text primary key,
  role       text not null default 'client'
             check (role in ('admin', 'scheduler', 'client')),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
