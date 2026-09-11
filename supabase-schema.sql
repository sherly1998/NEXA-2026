create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade text not null check (grade in ('A','B+','B','C')) default 'C',
  rating integer not null default 0,
  games integer not null default 0, wins integer not null default 0,
  balls integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(), title text not null default 'PB NEXA',
  courts integer not null default 3 check(courts between 3 and 4), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id), status text not null default 'active' check(status in ('active','playing','home')),
  checked_in_at timestamptz not null default now(), left_at timestamptz, unique(session_id,player_id)
);
create table if not exists matches (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions(id) on delete cascade,
  court integer not null, teams jsonb not null, status text not null default 'playing' check(status in ('playing','done')),
  score_a integer, score_b integer, balls integer, created_at timestamptz not null default now(), ended_at timestamptz
);
alter table players enable row level security; alter table sessions enable row level security;
alter table attendance enable row level security; alter table matches enable row level security;
create policy "club access players" on players for all using (true) with check (true);
create policy "club access sessions" on sessions for all using (true) with check (true);
create policy "club access attendance" on attendance for all using (true) with check (true);
create policy "club access matches" on matches for all using (true) with check (true);
alter publication supabase_realtime add table attendance, matches, sessions;
