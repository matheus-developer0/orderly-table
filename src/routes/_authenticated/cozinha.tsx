import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Bike,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cozinha")({
  component: CozinhaPage,
});

type OrderStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

type OrderItem = {
  id: string;
  name_snapshot: string;
  quantity: number;
  price_snapshot: number;
  notes: string | null;
};

type Order = {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  notes: string | null;
  total: number;
  type: string;
  table_id: string | null;
  table_number?: number | null;
  order_items: OrderItem[];
};

const COLUMNS: { key: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "new", label: "Novos", icon: <AlertCircle className="h-4 w-4" />, color: "text-yellow-500" },
  { key: "preparing", label: "Preparo", icon: <ChefHat className="h-4 w-4" />, color: "text-blue-500" },
  { key: "ready", label: "Pronto", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-500" },
  { key: "out_for_delivery", label: "Saiu", icon: <Bike className="h-4 w-4" />, color: "text-purple-500" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: "new",
  ready: "preparing",
  out_for_delivery: "ready",
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function OrderCard({
  order,
  onAdvance,
  onBack,
  onCancel,
  moving,
}: {
  order: Order;
  onAdvance: (id: string, next: OrderStatus) => void;
  onBack: (id: string, prev: OrderStatus) => void;
  onCancel: (id: string) => void;
  moving: string | null;
}) {
  const next = NEXT_STATUS[order.status];
  const prev = PREV_STATUS[order.status];
  const isBusy = moving === order.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card space-y-3",
        isBusy && "opacity-60 pointer-events-none",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {order.table_number ? `Mesa ${order.table_number}` : order.type === "delivery" ? "Delivery" : "Balcão"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(order.created_at)}
          </div>
        </div>
        <button
          onClick={() => onCancel(order.id)}
          className="text-muted-foreground hover:text-destructive transition-colors p-1"
          title="Cancelar pedido"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1.5">
        {order.order_items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <span className="shrink-0 min-w-[20px] h-5 rounded bg-primary/10 text-primary text-[11px] font-bold grid place-items-center px-1">
              {item.quantity}x
            </span>
            <div>
              <span className="text-sm font-medium">{item.name_snapshot}</span>
              {item.notes && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  ⚠️ {item.notes}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {order.notes && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          📝 {order.notes}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {prev && (
          <button
            onClick={() => onBack(order.id, prev)}
            className="flex-1 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            ← Voltar
          </button>
        )}
        {next && (
          <button
            onClick={() => onAdvance(order.id, next)}
            disabled={isBusy}
            className="flex-1 h-8 rounded-lg gradient-brand text-xs font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02]"
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Avançar →"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CozinhaPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("orders")
      .select(`
        id,status,created_at,updated_at,notes,total,type,table_id,
        order_items(id,name_snapshot,quantity,price_snapshot,notes)
      `)
      .eq("restaurant_id", restaurant.id)
      .in("status", ["new", "preparing", "ready", "out_for_delivery"])
      .order("created_at");

    if (!data) return;

    // Buscar números das mesas
    const tableIds = [...new Set(data.map((o) => o.table_id).filter(Boolean))] as string[];
    let tableMap: Record<string, number> = {};
    if (tableIds.length > 0) {
      const { data: tables } = await supabase
        .from("tables")
        .select("id,number")
        .in("id", tableIds);
      tableMap = Object.fromEntries((tables ?? []).map((t) => [t.id, t.number]));
    }

    setOrders(
      data.map((o) => ({
        ...o,
        table_number: o.table_id ? tableMap[o.table_id] ?? null : null,
        order_items: (o.order_items as OrderItem[]) ?? [],
      })),
    );
    setLoading(false);
  }, [restaurant]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime + beep on new orders
  useEffect(() => {
    if (!restaurant) return;
    const beep = () => {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        o.start(); o.stop(ctx.currentTime + 0.42);
      } catch { /* audio not allowed yet */ }
    };
    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => { beep(); toast.success("🔔 Novo pedido na cozinha!"); void load(); },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` },
        () => void load(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [restaurant, load]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setMoving(id);
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setMoving(null);
    if (error) return toast.error(error.message);
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o)).filter((o) =>
        ["new", "preparing", "ready", "out_for_delivery"].includes(o.status)
      ),
    );
    toast.success("Pedido atualizado");
  };

  const cancelOrder = async (id: string) => {
    await updateStatus(id, "cancelled");
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
            <ChefHat className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Painel</div>
            <h1 className="text-xl font-extrabold tracking-tight">Cozinha</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} ativo{orders.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => void load()}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col.key);
            return (
              <div key={col.key} className="w-72 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={col.color}>{col.icon}</span>
                  <span className="text-sm font-bold">{col.label}</span>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    {colOrders.length}
                  </span>
                </div>
                <div className="flex-1 rounded-2xl bg-muted/30 p-3 space-y-3 min-h-[200px]">
                  <AnimatePresence mode="popLayout">
                    {colOrders.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="grid place-items-center py-10 text-xs text-muted-foreground"
                      >
                        Nenhum pedido
                      </motion.div>
                    )}
                    {colOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onAdvance={(id, next) => void updateStatus(id, next)}
                        onBack={(id, prev) => void updateStatus(id, prev)}
                        onCancel={cancelOrder}
                        moving={moving}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
