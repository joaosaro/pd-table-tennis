-- Create items table
create table if not exists items (
  id bigint primary key generated always as identity,
  name text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (optional - disabled for testing)
-- alter table items enable row level security;

-- Allow all operations for anonymous users (for testing only)
-- In production, you'd want proper RLS policies
