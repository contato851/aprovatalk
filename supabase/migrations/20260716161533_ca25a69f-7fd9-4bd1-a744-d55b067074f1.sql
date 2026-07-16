-- Trigger functions: revoke all direct EXECUTE; triggers run as table owner
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_admin_bootstrap() FROM PUBLIC, anon, authenticated;

-- has_role is required inside RLS policies; restrict to authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;