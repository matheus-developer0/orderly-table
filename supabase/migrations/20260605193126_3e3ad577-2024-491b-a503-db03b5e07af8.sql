
-- 1. Add search_path to touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$ begin new.updated_at = now(); return new; end; $$;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.has_any_role_in(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. order_items_staff_all: mirror USING in WITH CHECK
DROP POLICY IF EXISTS "order_items_staff_all" ON public.order_items;
CREATE POLICY "order_items_staff_all" ON public.order_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = order_items.order_id
    AND (r.owner_id = auth.uid() OR public.has_any_role_in(auth.uid(), r.id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = order_items.order_id
    AND (r.owner_id = auth.uid() OR public.has_any_role_in(auth.uid(), r.id))
));

-- 4. Scoped public INSERT policies
DROP POLICY IF EXISTS "orders_public_insert" ON public.orders;
CREATE POLICY "orders_scoped_insert" ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  (table_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = orders.table_id AND t.restaurant_id = orders.restaurant_id
  ))
  OR
  (auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid())
    OR public.has_any_role_in(auth.uid(), orders.restaurant_id)
  ))
);

DROP POLICY IF EXISTS "suborders_public_insert" ON public.suborders;
CREATE POLICY "suborders_scoped_insert" ON public.suborders FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = suborders.order_id));

DROP POLICY IF EXISTS "order_items_public_insert" ON public.order_items;
CREATE POLICY "order_items_scoped_insert" ON public.order_items FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));

DROP POLICY IF EXISTS "waiter_calls_public_insert" ON public.waiter_calls;
CREATE POLICY "waiter_calls_scoped_insert" ON public.waiter_calls FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tables t
  WHERE t.id = waiter_calls.table_id AND t.restaurant_id = waiter_calls.restaurant_id
));

-- 5. Notifications: only staff may insert
DROP POLICY IF EXISTS "notifications_any_insert" ON public.notifications;
CREATE POLICY "notifications_staff_insert" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = notifications.restaurant_id AND r.owner_id = auth.uid())
  OR public.has_any_role_in(auth.uid(), notifications.restaurant_id)
);

-- 6. Lock down public SELECT on operational tables
DROP POLICY IF EXISTS "orders_public_read" ON public.orders;
CREATE POLICY "orders_staff_read" ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid())
  OR public.has_any_role_in(auth.uid(), orders.restaurant_id)
);

DROP POLICY IF EXISTS "suborders_public_read" ON public.suborders;
CREATE POLICY "suborders_staff_read" ON public.suborders FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.id = suborders.order_id
    AND (r.owner_id = auth.uid() OR public.has_any_role_in(auth.uid(), r.id))
));

DROP POLICY IF EXISTS "order_items_public_read" ON public.order_items;

DROP POLICY IF EXISTS "waiter_calls_public_read" ON public.waiter_calls;
CREATE POLICY "waiter_calls_staff_read" ON public.waiter_calls FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = waiter_calls.restaurant_id AND r.owner_id = auth.uid())
  OR public.has_any_role_in(auth.uid(), waiter_calls.restaurant_id)
);

-- 7. Restaurants: safe public view
DROP POLICY IF EXISTS "restaurants_public_read" ON public.restaurants;
CREATE POLICY "restaurants_staff_read" ON public.restaurants FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.has_any_role_in(auth.uid(), id));

DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public AS
SELECT id, name, slug, logo_url, primary_color, accent_color, address
FROM public.restaurants;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- 8. Realtime: require authentication
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
CREATE POLICY "realtime_authenticated_read" ON realtime.messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;
CREATE POLICY "realtime_authenticated_write" ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true);
