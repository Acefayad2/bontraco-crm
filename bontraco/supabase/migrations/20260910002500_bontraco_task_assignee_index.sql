create index tasks_account_assignee_idx
  on public.tasks (account_id, assigned_to);
