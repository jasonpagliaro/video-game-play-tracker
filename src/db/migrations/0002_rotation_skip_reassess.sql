alter table app_settings
  add column if not exists rotation_skip_cooldown_days integer not null default 90,
  add column if not exists rotation_skip_limit integer not null default 3,
  add column if not exists parked_reassessment_days integer not null default 180;

alter table app_settings
  add constraint app_settings_rotation_skip_cooldown_positive check (rotation_skip_cooldown_days > 0),
  add constraint app_settings_rotation_skip_limit_positive check (rotation_skip_limit > 0),
  add constraint app_settings_parked_reassessment_positive check (parked_reassessment_days > 0);

alter table games
  add column if not exists rotation_skip_count integer not null default 0,
  add column if not exists rotation_skip_until timestamptz,
  add column if not exists rotation_last_skipped_at timestamptz,
  add column if not exists parked_for_later boolean not null default false,
  add column if not exists reassess_after timestamptz;

alter table games
  add constraint games_rotation_skip_count_nonnegative check (rotation_skip_count >= 0);

create index if not exists games_user_reassess_idx on games(user_id, reassess_after);
