create extension if not exists pgcrypto;

create type game_status as enum ('not_started', 'installed', 'in_progress', 'completed', 'dnf', 'parked', 'wont_complete');
create type backlog_slot as enum ('short', 'narrative', 'horror', 'action', 'puzzle', 'rpg_long', 'strategy', 'coop', 'experimental', 'parking_lot');
create type completion_type as enum ('completable', 'endless', 'sandbox', 'multiplayer', 'live_service', 'roguelike', 'unknown');
create type personal_interest as enum ('high', 'medium', 'low', 'unknown');
create type sync_state as enum ('imported', 'synced', 'missing_from_latest_sync', 'manually_added', 'ignored');
create type sync_type as enum ('library', 'playtime', 'achievements', 'full');
create type sync_status as enum ('success', 'partial', 'failed');
create type checkin_decision as enum ('continue', 'pause', 'park', 'dnf', 'complete');
create type milestone_type as enum ('time_played', 'percent_complete', 'chapter', 'manual', 'achievement_based');

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  max_active_rotation_count integer not null default 5 check (max_active_rotation_count > 0),
  max_installed_count integer,
  checkin_interval_days integer not null default 7,
  checkin_interval_hours_played integer not null default 2,
  completed_sets_installed_false boolean not null default true,
  dnf_sets_installed_false boolean not null default true,
  parked_sets_installed_false boolean not null default true,
  in_progress_sets_installed_true boolean not null default true,
  in_progress_adds_to_rotation_when_space boolean not null default true,
  auto_queue_new_imports boolean not null default false,
  protect_manual_fields_from_sync boolean not null default true,
  queue_sliding_window_size integer not null default 5,
  slot_weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index app_settings_user_id_uq on app_settings(user_id);

create table games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steam_app_id integer,
  steamid64_owner text,
  title text not null,
  normalized_title text not null,
  source text not null default 'Steam',
  playtime_minutes integer not null default 0 check (playtime_minutes >= 0),
  playtime_windows_minutes integer,
  playtime_mac_minutes integer,
  playtime_linux_minutes integer,
  last_played timestamptz,
  achievements_unlocked integer,
  achievements_total integer,
  achievement_percent double precision,
  steam_review_score integer,
  steam_review_summary text,
  release_year integer,
  genres jsonb,
  tags jsonb,
  estimated_hours double precision,
  completion_type completion_type not null default 'unknown',
  backlog_slot backlog_slot not null default 'experimental',
  priority_score integer not null default 50,
  queue_rank integer,
  queue_locked boolean not null default false,
  status game_status not null default 'not_started',
  installed boolean not null default false,
  current_rotation boolean not null default false,
  date_added timestamptz not null default now(),
  date_started timestamptz,
  date_completed timestamptz,
  date_dnf timestamptz,
  dnf_reason text,
  personal_interest personal_interest not null default 'unknown',
  sync_state sync_state not null default 'imported',
  first_seen_at timestamptz not null default now(),
  last_seen_in_sync_at timestamptz,
  last_synced_at timestamptz,
  notes text,
  manual_backlog_slot boolean not null default false,
  manual_completion_type boolean not null default false,
  raw_import_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_user_status_idx on games(user_id, status);
create index games_user_rotation_idx on games(user_id, current_rotation);
create index games_user_queue_idx on games(user_id, queue_rank);
create unique index games_user_steam_app_id_uq on games(user_id, steam_app_id) where steam_app_id is not null;
create unique index games_user_title_source_uq on games(user_id, normalized_title, source) where steam_app_id is null;
create unique index games_user_queue_rank_uq on games(user_id, queue_rank) where queue_rank is not null;

create table steam_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  custom_profile_id text,
  steamid64 text,
  profile_url text,
  api_key_encrypted_or_env_reference text,
  sync_enabled boolean not null default false,
  last_library_sync_at timestamptz,
  last_achievement_sync_at timestamptz,
  last_playtime_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rotation_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_name backlog_slot not null,
  max_active_count integer not null default 1,
  desired_weight double precision,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now(),
  filename text not null,
  row_count integer not null default 0,
  added_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  notes text
);

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  steam_account_id uuid references steam_accounts(id) on delete set null,
  sync_type sync_type not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status sync_status not null default 'success',
  added_count integer not null default 0,
  updated_count integer not null default 0,
  missing_count integer not null default 0,
  error_message text,
  notes text
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  milestone_name text not null,
  milestone_type milestone_type not null default 'manual',
  target_value text,
  completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  checkin_date timestamptz not null default now(),
  status_at_checkin game_status not null,
  hours_since_last_checkin double precision,
  fun_rating integer not null check (fun_rating between 1 and 5),
  friction_rating integer not null check (friction_rating between 1 and 5),
  desire_to_continue_rating integer not null check (desire_to_continue_rating between 1 and 5),
  decision checkin_decision not null,
  notes text,
  created_at timestamptz not null default now()
);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  previous_status game_status,
  new_status game_status not null,
  changed_at timestamptz not null default now(),
  notes text
);

create table category_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date timestamptz not null default now(),
  backlog_slot backlog_slot not null,
  completion_type completion_type not null,
  status game_status not null,
  count integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_settings_touch_updated_at before update on app_settings for each row execute function touch_updated_at();
create trigger games_touch_updated_at before update on games for each row execute function touch_updated_at();
create trigger steam_accounts_touch_updated_at before update on steam_accounts for each row execute function touch_updated_at();
create trigger rotation_slots_touch_updated_at before update on rotation_slots for each row execute function touch_updated_at();
create trigger milestones_touch_updated_at before update on milestones for each row execute function touch_updated_at();

create or replace function enforce_active_rotation_limit()
returns trigger language plpgsql as $$
declare
  active_count integer;
  configured_limit integer;
begin
  if new.current_rotation is distinct from true then
    return new;
  end if;

  select coalesce(max_active_rotation_count, 5)
    into configured_limit
    from app_settings
    where user_id = new.user_id;

  if configured_limit is null then
    configured_limit := 5;
  end if;

  select count(*)
    into active_count
    from games
    where user_id = new.user_id
      and current_rotation = true
      and id <> new.id;

  if active_count + 1 > configured_limit then
    raise exception 'current rotation limit exceeded: % active would exceed configured limit %', active_count + 1, configured_limit;
  end if;

  return new;
end;
$$;

create trigger games_enforce_active_rotation_limit
before insert or update of current_rotation on games
for each row execute function enforce_active_rotation_limit();

alter table app_settings enable row level security;
alter table games enable row level security;
alter table steam_accounts enable row level security;
alter table rotation_slots enable row level security;
alter table import_batches enable row level security;
alter table sync_runs enable row level security;
alter table milestones enable row level security;
alter table check_ins enable row level security;
alter table status_history enable row level security;
alter table category_balance_snapshots enable row level security;

create policy app_settings_owner_all on app_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy games_owner_all on games for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy steam_accounts_owner_all on steam_accounts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy rotation_slots_owner_all on rotation_slots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy import_batches_owner_all on import_batches for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sync_runs_owner_all on sync_runs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy milestones_owner_all on milestones for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy check_ins_owner_all on check_ins for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy status_history_owner_all on status_history for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy category_balance_snapshots_owner_all on category_balance_snapshots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on app_settings, games, steam_accounts, rotation_slots, import_batches, sync_runs, milestones, check_ins, status_history, category_balance_snapshots to authenticated;

