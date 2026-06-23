alter table app_settings
  add column if not exists steam_auto_sync_enabled boolean not null default true,
  add column if not exists steam_sync_interval_days integer not null default 1,
  add column if not exists steam_sync_interval_hours integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_settings'::regclass
      and conname = 'app_settings_steam_sync_days_nonnegative'
  ) then
    alter table app_settings
      add constraint app_settings_steam_sync_days_nonnegative check (steam_sync_interval_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_settings'::regclass
      and conname = 'app_settings_steam_sync_hours_range'
  ) then
    alter table app_settings
      add constraint app_settings_steam_sync_hours_range check (
        steam_sync_interval_hours >= 0 and steam_sync_interval_hours <= 23
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_settings'::regclass
      and conname = 'app_settings_steam_sync_interval_positive'
  ) then
    alter table app_settings
      add constraint app_settings_steam_sync_interval_positive check (
        steam_sync_interval_days > 0 or steam_sync_interval_hours > 0
      );
  end if;
end
$$;
