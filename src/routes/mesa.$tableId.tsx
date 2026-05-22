import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Utensils, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/mesa/$tableId")({
  component: MesaPage,
});

type Loaded = {
  table: { id: string; number: number; restaurant_id: string };
  restaurant: { id: string; name: string; primary_color: string | null };
} | null;

function MesaPage() {
  const { tableId } = Route.useParams();
  const [data, setData] = useState<Loaded>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("tables")
        .select("id,number,restaurant_id")
        .eq("id", tableId)
        .maybeSingle();
      if (!t) {
        setLoading(false);
        return;
      }
      const { data: r } = await supabase
        .from("restaurants")
        .select("id,name,primary_color")
        .eq("id", t.restaurant_id)
        .maybeSingle();
      if (r) setData({ table: t, restaurant: r });
      setLoading(false);
    })();
  }, [tableId]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">Mesa não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifique o QR Code e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div
        className="relative overflow-hidden px-6 pb-10 pt-12 text-primary-foreground"
        style={{
          background: `linear-gradient(135deg, ${data.restaurant.primary_color ?? "#E11D2E"}, #1a1a1a)`,
        }}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-auto max-w-lg space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70">
            <Utensils className="h-3.5 w-3.5" />
            Mesa {data.table.number}
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            Bem-vindo ao {data.restaurant.name}
          </h1>
          <p className="text-sm text-white/80">
            O cardápio digital interativo, carrinho compartilhado e pedidos em tempo
            real chegam na Fase 2.
          </p>
        </motion.div>
      </div>

      <div className="mx-auto max-w-lg px-6 py-8">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/40">
            <Sparkles className="h-7 w-7 text-accent-foreground" />
          </div>
          <h2 className="mt-5 text-lg font-bold">Cardápio em construção</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Você acessou pela <strong>Mesa {data.table.number}</strong>. Quando a
            Fase 2 estiver liberada, você verá o cardápio completo aqui, fará
            pedidos e acompanhará o status em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
