import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HandPlatter,
  Loader2,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/garcom")({
  component: GarcomPage,
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
  notes: string | null;
  total: number;
  type: string;
  table_id: string | null;
  table_number?: number | null;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Novo",
  preparing: "Preparando",
  ready: "Pronto ✓",
  out_for_delivery: "Saiu",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: "bg-yellow-500/10 text-yellow-600",
  preparing: "bg-blue-500/10 text-blue-600",
  ready: "bg-green-500/10 text-green-600",
  out_for_delivery: "bg-purple-500/10 text-purple-600",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function OrderRow({ order, onDeliver }: { order: Order; onDeliver: (id: string) => void }) {
  const [expanded, setExpanded] = useState(order.status === "ready");
  const isReady = order.status === "ready";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "rounded-2xl border bg-card shadow-card overflow-hidden",
        isReady ? "border-green-500/40 ring-1 ring-green-500/20" : "border-border",
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {isReady && (
          <div className="relative">
            <Bell className="h-5 w-5 text-green-500" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">
              {order.table_number ? `Mesa ${order.table_number}` : order.type === "delivery" ? "Delivery" : "Balcão"}
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", STATUS_COLOR[order.status])}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo(order.created_at)}
            <span className="text-border">·</span>
            <Receipt className="h-3 w-3" />
            R$ {Number(order.total).toFixed(2).replace(".", ",")}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <ul className="space-y-2">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">
                        {item.quantity}x
                      </span>
                      <div>
                        <span>{item.name_snapshot}</span>
                        {item.notes && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">⚠️ {item.notes}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      R$ {(item.price_snapshot * item.quantity).toFixed(2).replace(".", ",")}
                    </span>
                  </li>
                ))}
              </ul>
              {order.notes && (
                <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  📝 {order.notes}
                </div>
              )}
              {isReady && (
                <button
                  onClick={() => onDeliver(order.id)}
                  className="flex w-full items-center justify-center gap-2 h-10 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar entrega
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GarcomPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ready">("all");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("orders")
      .select(`
        id,status,created_at,notes,total,type,table_id,
        order_items(id,name_snapshot,quantity,price_snapshot,notes)
      `)
      .eq("restaurant_id", restaurant.id)
      .in("status", ["new", "preparing", "ready", "out_for_delivery"])
      .order("created_at", { ascending: false });

    if (!data) return;

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

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase
      .channel(`waiter-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const deliver = async (id: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entrega confirmada!");
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const readyCount = orders.filter((o) => o.status === "ready").length;
  const shown = filter === "ready" ? orders.filter((o) => o.status === "ready") : orders;

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/40">
            <HandPlatter className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-xl font-extrabold tracking-tight">Painel do Garçom</h1>
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "ready"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 h-9 text-sm font-semibold transition-all",
              filter === f ? "gradient-brand text-primary-foreground shadow-brand" : "border border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {f === "all" ? `Todos (${orders.length})` : (
              <>
                <Bell className="h-3.5 w-3.5" />
                Prontos {readyCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{readyCount}</span>}
              </>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "ready" ? "Nenhum pedido pronto no momento." : "Nenhum pedido ativo."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {shown.map((order) => (
              <OrderRow key={order.id} order={order} onDeliver={deliver} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
