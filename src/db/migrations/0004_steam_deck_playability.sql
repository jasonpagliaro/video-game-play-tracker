alter table games
  add column if not exists steam_deck_compatibility_category text,
  add column if not exists steam_deck_compatibility_items jsonb,
  add column if not exists protondb_tier text,
  add column if not exists protondb_confidence text,
  add column if not exists protondb_score double precision,
  add column if not exists protondb_report_count integer,
  add column if not exists deck_playability_updated_at timestamptz,
  add column if not exists deck_playability_raw jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'games'::regclass
      and conname = 'games_protondb_report_count_nonnegative'
  ) then
    alter table games
      add constraint games_protondb_report_count_nonnegative check (protondb_report_count is null or protondb_report_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'games'::regclass
      and conname = 'games_protondb_score_range'
  ) then
    alter table games
      add constraint games_protondb_score_range check (protondb_score is null or (protondb_score >= 0 and protondb_score <= 1));
  end if;
end
$$;
