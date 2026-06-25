-- An auth account can be deleted while its user_profiles row (and the historical
-- FK references to it) remain — an "orphaned" profile. Because user_profiles.email
-- is UNIQUE, creating a brand-new auth account for that same email makes
-- handle_new_user()'s INSERT collide and roll back the entire auth.users insert,
-- which is what broke admin "add participant" (and would break self-signup) for
-- any email that had previously been deleted.
--
-- Defensively free the email from any *confirmed-orphan* profile (one with no
-- matching auth user) before inserting the new profile. The orphan row and its
-- historical FK references are preserved under a mangled email for later cleanup,
-- rather than blocking account creation. Real duplicate emails (profile WITH a
-- live auth user) are left untouched — Supabase auth blocks those upstream anyway.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_profiles
     SET email = email || '+stale-' || id::text
   WHERE email = NEW.email
     AND id <> NEW.id
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = public.user_profiles.id);

  INSERT INTO public.user_profiles (id, email, full_name, modules)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    ARRAY[]::text[]
  );
  RETURN NEW;
END;
$function$;
