create table users (
  id            bigint generated always as identity primary key,
  nickname      text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- "Moomin" and "moomin" are the same nickname (API.md)
create unique index users_nickname_lower on users (lower(nickname));

create table sessions (
  token_hash text primary key,
  user_id    bigint not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user_id on sessions (user_id);