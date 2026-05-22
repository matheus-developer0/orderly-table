import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Pizza } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  featured: boolean;
};

function ProdutosPage() {
  const { restaurant } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurant) return;
    void supabase
      .from("products")
      .select("id,name,description,price,available,featured")
      .eq("restaurant_id", restaurant.id)
      .order("created_at")
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [restaurant?.id]);

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Operação
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Cardápio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} produtos cadastrados. Edição completa chega na Fase 3.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/40">
                  <Pizza className="h-5 w-5 text-accent-foreground" />
                </div>
                {p.featured && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Destaque
                  </span>
                )}
              </div>
              <div className="mt-3 text-base font-bold">{p.name}</div>
              {p.description && (
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {p.description}
                </div>
              )}
              <div className="mt-4 text-lg font-extrabold tracking-tight text-primary">
                R$ {Number(p.price).toFixed(2).replace(".", ",")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
