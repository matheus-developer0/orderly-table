
-- Promotions table
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'percent', -- percent | fixed | combo
  value numeric NOT NULL DEFAULT 0,
  scope text,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_public_read_active" ON public.promotions
  FOR SELECT TO public USING (active = true);

CREATE POLICY "promotions_staff_all" ON public.promotions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = promotions.restaurant_id AND r.owner_id = auth.uid())
    OR has_any_role_in(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = promotions.restaurant_id AND r.owner_id = auth.uid())
    OR has_any_role_in(auth.uid(), restaurant_id)
  );

CREATE TRIGGER promotions_touch_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cash sessions table
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric NOT NULL DEFAULT 0,
  closed_at timestamptz,
  closing_amount numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_staff_all" ON public.cash_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = cash_sessions.restaurant_id AND r.owner_id = auth.uid())
    OR has_any_role_in(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = cash_sessions.restaurant_id AND r.owner_id = auth.uid())
    OR has_any_role_in(auth.uid(), restaurant_id)
  );

CREATE INDEX idx_cash_sessions_restaurant_open ON public.cash_sessions(restaurant_id) WHERE closed_at IS NULL;
CREATE INDEX idx_promotions_restaurant ON public.promotions(restaurant_id);
