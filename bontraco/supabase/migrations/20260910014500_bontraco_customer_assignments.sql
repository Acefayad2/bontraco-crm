-- Enforce same-workspace customer assignees at the relationship boundary.

alter table public.contacts
  add constraint contacts_account_assignee_fkey
  foreign key (account_id, assigned_to)
  references public.memberships(account_id, user_id)
  on delete set null (assigned_to);
