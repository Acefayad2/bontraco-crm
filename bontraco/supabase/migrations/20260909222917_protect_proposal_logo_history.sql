-- Preserve historical proposal branding; only reviewed service operations may purge objects.
drop policy bontraco_branding_object_delete_manager on storage.objects;
