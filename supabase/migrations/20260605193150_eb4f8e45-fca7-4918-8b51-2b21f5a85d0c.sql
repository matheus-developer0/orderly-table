
ALTER VIEW public.restaurants_public SET (security_invoker = on);

-- Restrict anon's column access to the safe set; RLS still applies
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (id, name, slug, logo_url, primary_color, accent_color, address)
  ON public.restaurants TO anon;

-- Allow anon to read those safe columns via RLS (view will be the recommended path)
CREATE POLICY "restaurants_public_safe_read" ON public.restaurants
  FOR SELECT TO anon USING (true);
