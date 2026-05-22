import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Store, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function OnboardingPage() {
  const { session, user, loading, restaurant, refreshRestaurant } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tables, setTables] = useState(8);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    if (!loading && restaurant) navigate({ to: "/admin" });
  }, [session, loading, restaurant, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: rest, error } = await supabase
      .from("restaurants")
      .insert({ name, slug, owner_id: user.id })
      .select()
      .single();

    if (error || !rest) {
      setBusy(false);
      return toast.error(error?.message ?? "Falha ao criar restaurante");
    }

    // owner role
    await supabase.from("user_roles").insert({
      user_id: user.id,
      restaurant_id: rest.id,
      role: "owner",
    });

    // profile -> restaurant
    await supabase.from("profiles").update({ restaurant_id: rest.id }).eq("id", user.id);

    // generate tables
    const rows = Array.from({ length: tables }, (_, i) => ({
      restaurant_id: rest.id,
      number: i + 1,
      qr_code: `${rest.slug}-mesa-${i + 1}`,
    }));
    await supabase.from("tables").insert(rows);

    // seed categories + products
    const { data: cats } = await supabase
      .from("categories")
      .insert([
        { restaurant_id: rest.id, name: "Mais vendidos", sort_order: 0 },
        { restaurant_id: rest.id, name: "Hambúrgueres", sort_order: 1 },
        { restaurant_id: rest.id, name: "Pizzas", sort_order: 2 },
        { restaurant_id: rest.id, name: "Bebidas", sort_order: 3 },
      ])
      .select();

    if (cats) {
      const byName = Object.fromEntries(cats.map((c) => [c.name, c.id]));
      await supabase.from("products").insert([
        {
          restaurant_id: rest.id,
          category_id: byName["Hambúrgueres"],
          name: "Smash Duplo",
          description: "Pão brioche, 2 blends 90g, queijo cheddar derretido, picles e molho da casa.",
          price: 32.9,
          featured: true,
          prep_minutes: 12,
        },
        {
          restaurant_id: rest.id,
          category_id: byName["Hambúrgueres"],
          name: "Cheddar Bacon",
          description: "Blend 180g, cheddar inglês, bacon crocante, cebola caramelizada.",
          price: 36.9,
          prep_minutes: 14,
        },
        {
          restaurant_id: rest.id,
          category_id: byName["Pizzas"],
          name: "Margherita",
          description: "Molho de tomate San Marzano, muçarela de búfala, manjericão fresco.",
          price: 49.9,
          featured: true,
          prep_minutes: 20,
        },
        {
          restaurant_id: rest.id,
          category_id: byName["Pizzas"],
          name: "Pepperoni Premium",
          description: "Muçarela, pepperoni artesanal, orégano e azeite extra-virgem.",
          price: 58.9,
          prep_minutes: 22,
        },
        {
          restaurant_id: rest.id,
          category_id: byName["Bebidas"],
          name: "Coca-Cola 350ml",
          price: 7.5,
          prep_minutes: 1,
        },
        {
          restaurant_id: rest.id,
          category_id: byName["Bebidas"],
          name: "Suco Natural de Laranja",
          price: 12.0,
          prep_minutes: 3,
        },
      ]);
    }

    await refreshRestaurant();
    toast.success("Restaurante criado! Bem-vindo a bordo.");
    navigate({ to: "/admin" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg space-y-8"
      >
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand shadow-brand">
            <Store className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
            Vamos configurar seu restaurante
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie em segundos. Você poderá ajustar tudo depois.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8"
        >
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Nome do restaurante
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Pizzaria Bella Napoli"
              className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Quantas mesas?
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={50}
                value={tables}
                onChange={(e) => setTables(parseInt(e.target.value))}
                className="flex-1 accent-primary"
              />
              <div className="grid h-12 w-16 place-items-center rounded-xl bg-muted text-lg font-bold">
                {tables}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Geramos QR Codes únicos para cada mesa automaticamente.
            </p>
          </div>

          <div className="rounded-xl border border-accent/40 bg-accent/20 p-3 text-xs text-accent-foreground">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Cardápio de exemplo será criado
            </div>
            <div className="mt-1 text-accent-foreground/70">
              Hambúrgueres, pizzas e bebidas para você testar imediatamente.
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !name}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand transition-all hover:scale-[1.01] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar restaurante"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
