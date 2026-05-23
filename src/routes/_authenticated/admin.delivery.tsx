import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bike, MapPin, Phone, Clock, CheckCircle2, Loader2, Package } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  component: DeliveryPage,
});

type Order = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
};

const COLUMNS = [
  { key: "new", label: "Recebidos", color: "border-yellow-500/40 bg-yellow-500/5" },
  { key: "preparing", label: "Preparando", color: "border-blue-500/40 bg-blue-500/5" },
  { key: "ready", label: "Prontos p/ envio", color: "border-green-500/40 bg-green-500/5" },
  { key: "out_for_delivery", label: "Em rota", color: "border-purple-500/40 bg-purple-500/5" },
  { key: "delivered", label: "Entregues", color: "border-muted bg-muted/30" },
] as const;

function DeliveryPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("orders")
      .select("id,status,total,created_at,notes")
      .eq("restaurant_id", restaurant.id)
      .eq("type", "delivery")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`delivery-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const advance = async (o: Order, next: string) => {
    const { error } = await supabase.from("orders").update({ status: next as never }).eq("id", o.id);
    if (error) toast.error("Erro ao atualizar"); else toast.success("Status atualizado");
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}min`; return `${Math.floor(s / 3600)}h`;
  };

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Bike className="h-7 w-7 text-primary" /> Delivery
          </h1>
          <p className="text-sm text-muted-foreground">Painel de entregas em tempo real</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hoje</div>
          <div className="text-xl font-extrabold">{orders.length} pedidos</div>
        </div>
      </header>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = orders.filter((o) => o.status === col.key);
            const nextStatus: Record<string, string> = {
              new: "preparing", preparing: "ready", ready: "out_for_delivery", out_for_delivery: "delivered",
            };
            return (
              <div key={col.key} className={cn("rounded-2xl border-2 p-3 min-h-[200px]", col.color)}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider">{col.label}</h3>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="text-center text-[11px] text-muted-foreground py-6">Nada aqui</div>
                  )}
                  {items.map((o) => (
                    <motion.div key={o.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="rounded-xl bg-card p-3 shadow-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">#{o.id.slice(0, 6)}</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />{timeAgo(o.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{o.notes ?? "Endereço não informado"}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <span className="font-extrabold text-sm">{fmt(Number(o.total))}</span>
                        {nextStatus[col.key] && (
                          <button onClick={() => void advance(o, nextStatus[col.key])}
                            className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90">
                            {col.key === "ready" ? "Despachar" : col.key === "out_for_delivery" ? "Entregue" : "Avançar"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum pedido de delivery hoje ainda.</p>
        </div>
      )}
    </div>
  );
}
