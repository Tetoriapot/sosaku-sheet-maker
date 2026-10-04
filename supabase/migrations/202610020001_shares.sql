-- Apply once in the Supabase SQL Editor before selecting SHARE_STORAGE=supabase.
-- Browsers never access this table directly. All access is through the Node API.
create table public.creative_shares (
  id text primary key check (id ~ '^pub_[0-9a-f-]{36}$'),
  kind text not null check (kind in ('sheet', 'answer')),
  data jsonb,
  token_hash text not null check (length(token_hash) = 64),
  content_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint payload_size check (data is null or octet_length(data::text) <= 900000)
);
alter table public.creative_shares enable row level security;
revoke all on table public.creative_shares from public, anon, authenticated;
grant select, insert, update on table public.creative_shares to service_role;
-- No public SELECT policy: even anonymous visitors cannot enumerate all shares.
-- Revocation removes the payload but retains the ID to prevent retry resurrection.
