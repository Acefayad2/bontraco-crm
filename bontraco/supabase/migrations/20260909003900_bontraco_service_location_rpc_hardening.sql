alter function public.set_bontraco_property_active(uuid, uuid, boolean) security invoker;
revoke all on function public.guard_bontraco_property_lifecycle() from public, anon, authenticated;
