alter table public.communication_consents
  add constraint communication_consents_purpose_channel_check
  check (purpose not in ('artificial_voice', 'recording') or channel = 'voice');
