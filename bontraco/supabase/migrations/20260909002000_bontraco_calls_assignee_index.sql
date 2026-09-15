create index calls_assigned_to_idx on public.calls (assigned_to) where assigned_to is not null;
