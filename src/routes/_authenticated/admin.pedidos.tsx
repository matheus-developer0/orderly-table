import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Receipt, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: PedidosPage });

type OrderStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type OrderItem = { id: string; name_snapshot: string; quantity: number; price_snapshot: number; notes: string | null };
type Order = {
  id: string; status: OrderStatus; type: string; total: number;
  created_at: string; table_id: string | null; notes: string | null;
  cancel_reason: string | null; table_number: number | null;
  order_items: OrderItem[];
};

const SCOLOR: Record<OrderStatus, string> = {
  new: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  preparing: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  ready: "bg-green-500/10 text-green-700 border-green-500/30",
  out_for_delivery: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  delivered: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};
const SLABEL: Record<OrderStatus, string> = {
  new: "Novo", preparing: "Preparando", ready: "Pronto",
  out_for_delivery: "Saiu", delivered: "Entregue", cancelled: "Cancelado",
};
const FILTERS = ["all","new","preparing","ready","delivered","cancelled"] as const;
type Filter = typeof FILTERS[number];

function timeAgo(d: string) { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}min`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`; }
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function OrderDetailModal({ order, onClose, onStatusChange }: { order: Order; onClose: () => void; onStatusChange: () => void }) {
  const [saving, setSaving] = useState(false);

  const changeStatus = async (status: OrderStatus) => {
    setSaving(true);
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", order.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    onStatusChange(); onClose();
  };

  const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { new: "preparing", preparing: "ready", ready: "out_for_delivery", out_for_delivery: "delivered" };
  const next = NEXT_STATUS[order.status];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Pedido #{order.id.slice(0, 8)}</h2>
            <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-semibold">{order.table_number ? `Mesa ${order.table_number}` : order.type === "delivery" ? "🛵 Delivery" : "🥡 Balcão"}</div>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", SCOLOR[order.status])}>{SLABEL[order.status]}</span>
            <div className="text-2xl font-extrabold text-primary ml-auto">{fmt(order.total)}</div>
          </div>
          <ul className="space-y-2 border rounded-xl divide-y divide-border overflow-hidden">
            {order.order_items.map(item => (
              <li key={item.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{item.quantity}x</span>
                  <div><span>{item.name_snapshot}</span>{item.notes && <div className="text-xs text-amber-600">⚠️ {item.notes}</div>}</div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmt(item.price_snapshot * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">📝 {order.notes}</div>}
          {order.cancel_reason && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">❌ Cancelado: {order.cancel_reason}</div>}
        </div>
        {next && (
          <div className="px-6 py-4 border-t border-border">
            <button onClick={() => void changeStatus(next)} disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Avançar para "${SLABEL[next]}"`}
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

function PedidosPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase.from("orders")
      .select("id,status,type,total,created_at,table_id,notes,cancel_reason,order_items(id,name_snapshot,quantity,price_snapshot,notes)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const { data: tbs } = await supabase.from("tables").select("id,number").eq("restaurant_id", restaurant.id);
    setTables(Object.fromEntries((tbs ?? []).map(t => [t.id, t.number])));
    setOrders((data ?? []).map(o => ({
      ...o, status: o.status as OrderStatus,
      table_number: o.table_id ? (Object.fromEntries((tbs ?? []).map(t => [t.id, t.number])))[o.table_id] ?? null : null,
      order_items: (o.order_items as OrderItem[]) ?? [],
    })));
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`orders-list-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const filtered = orders.filter(o => {
    const ms = filter === "all" || o.status === filter;
    const mq = !search || o.id.toLowerCase().includes(search.toLowerCase()) || String(o.table_number ?? "").includes(search) || (o.notes ?? "").toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  const counts = FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f] = f === "all" ? orders.length : orders.filter(o => o.status === f).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{orders.length} pedidos · atualização em tempo real</p>
          </div>
          <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID, mesa ou observação..."
            className="input-base pl-9 pr-9" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("shrink-0 flex items-center gap-1.5 rounded-xl px-3 h-8 text-xs font-semibold transition-all",
                filter === f ? "gradient-brand text-primary-foreground shadow-brand" : "border border-border text-muted-foreground hover:bg-muted")}>
              {f === "all" ? "Todos" : SLABEL[f as OrderStatus]}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", filter === f ? "bg-white/20" : "bg-muted")}>{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border p-20 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((o, i) => {
                const SIcon = o.status === "delivered" ? CheckCircle2 : o.status === "cancelled" ? XCircle : Clock;
                return (
                  <motion.button key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 15) * 0.015 }}
                    onClick={() => setSelected(o)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated transition-all text-left">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-xl border shrink-0", SCOLOR[o.status])}>
                      <SIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{o.table_number ? `Mesa ${o.table_number}` : o.type === "delivery" ? "🛵 Delivery" : "🥡 Balcão"}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", SCOLOR[o.status])}>{SLABEL[o.status]}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">#{o.id.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <Clock className="h-3 w-3" />{fmtDate(o.created_at)}
                        <span>·</span>
                        {o.order_items.length} {o.order_items.length === 1 ? "item" : "itens"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-base">{fmt(o.total)}</div>
                      <div className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && <OrderDetailModal order={selected} onClose={() => setSelected(null)} onStatusChange={load} />}
      </AnimatePresence>
    </div>
  );
}
