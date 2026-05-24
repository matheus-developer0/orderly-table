import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HandPlatter, Loader2, Bell, CheckCircle2, Clock, RefreshCw, Receipt, ChevronDown, ChevronUp, DollarSign, Users, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/garcom")({ component: GarcomPage });

type OrderStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type OrderItem  = { id: string; name_snapshot: string; quantity: number; price_snapshot: number; notes: string | null };
type Suborder   = { id: string; customer_name: string; customer_phone: string | null; total: number; paid: boolean };
type Order      = { id: string; status: OrderStatus; created_at: string; notes: string | null; total: number; type: string; table_id: string | null; table_number?: number | null; order_items: OrderItem[]; suborders: Suborder[] };
type Call       = { id: string; reason: string; created_at: string; table_id: string; table_number: number };

const SLABEL: Record<OrderStatus, string> = { new: "Novo", preparing: "Preparando", ready: "Pronto ✓", out_for_delivery: "Saiu", delivered: "Entregue", cancelled: "Cancelado" };
const SCOLOR: Record<OrderStatus, string> = { new: "bg-yellow-500/10 text-yellow-600", preparing: "bg-blue-500/10 text-blue-600", ready: "bg-green-500/10 text-green-600", out_for_delivery: "bg-purple-500/10 text-purple-600", delivered: "bg-muted text-muted-foreground", cancelled: "bg-destructive/10 text-destructive" };

function timeAgo(d: string) { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}min`; return `${Math.floor(s / 3600)}h`; }
const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

function BillModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [subs, setSubs] = useState<Suborder[]>(order.suborders);
  const [saving, setSaving] = useState(false);
  const paid   = subs.filter(s => s.paid).reduce((a, s) => a + s.total, 0);
  const remain = order.total - paid;

  const togglePaid = async (sub: Suborder) => {
    setSaving(true);
    await supabase.from("suborders").update({ paid: !sub.paid }).eq("id", sub.id);
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, paid: !s.paid } : s));
    setSaving(false);
  };

  const closeTable = async () => {
    setSaving(true);
    await supabase.from("orders").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", order.id);
    if (order.table_id) await supabase.from("tables").update({ status: "free" }).eq("id", order.table_id);
    toast.success("Conta fechada! Mesa liberada.");
    onDone(); onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Fechar conta</h2>
            <p className="text-xs text-muted-foreground">{order.table_number ? `Mesa ${order.table_number}` : "Balcão"} · Total: {fmt(order.total)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
          {subs.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="text-3xl font-extrabold text-primary">{fmt(order.total)}</div>
              <div className="text-xs text-muted-foreground">Total da mesa — sem divisão individual</div>
            </div>
          ) : (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Por pessoa</div>
              {subs.map(sub => (
                <div key={sub.id} className={cn("flex items-center gap-3 rounded-xl border p-3 transition-all", sub.paid ? "bg-success/5 border-success/20" : "border-border")}>
                  <button onClick={() => void togglePaid(sub)} disabled={saving}
                    className={cn("h-6 w-6 shrink-0 rounded-full border-2 grid place-items-center transition-all", sub.paid ? "bg-success border-success" : "border-muted-foreground/40 hover:border-primary")}>
                    {sub.paid && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{sub.customer_name}</div>
                    {sub.customer_phone && <div className="text-xs text-muted-foreground">{sub.customer_phone}</div>}
                  </div>
                  <div className={cn("font-extrabold text-sm shrink-0", sub.paid && "line-through opacity-50")}>{fmt(sub.total)}</div>
                </div>
              ))}
              <div className="rounded-xl bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Pago</span><span className="font-bold text-success">{fmt(paid)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Restante</span><span className="font-bold text-primary">{fmt(remain)}</span></div>
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Fechar</button>
          <button onClick={() => void closeTable()} disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" />Liberar mesa</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function OrderRow({ order, onDeliver, onBill }: { order: Order; onDeliver: (id: string) => void; onBill: (o: Order) => void }) {
  const [open, setOpen] = useState(order.status === "ready");
  const isReady = order.status === "ready";
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className={cn("rounded-2xl border bg-card shadow-card overflow-hidden", isReady ? "border-green-500/40 ring-1 ring-green-500/20" : "border-border")}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 p-4 text-left">
        {isReady && <div className="relative shrink-0"><Bell className="h-5 w-5 text-green-500" /><span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" /></div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{order.table_number ? `Mesa ${order.table_number}` : order.type === "delivery" ? "🛵 Delivery" : "🥡 Balcão"}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", SCOLOR[order.status])}>{SLABEL[order.status]}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(order.created_at)}</span>
            <span className="flex items-center gap-1"><Receipt className="h-3 w-3" />{fmt(order.total)}</span>
            {order.suborders.length > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{order.suborders.length}p</span>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <ul className="space-y-2">
                {order.order_items.map(item => (
                  <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{item.quantity}x</span>
                      <div><span>{item.name_snapshot}</span>{item.notes && <div className="text-xs text-amber-600">⚠️ {item.notes}</div>}</div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{fmt(item.price_snapshot * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {order.notes && <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">📝 {order.notes}</div>}
              <div className="flex gap-2">
                {isReady && (
                  <button onClick={() => onDeliver(order.id)}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand">
                    <CheckCircle2 className="h-4 w-4" />Confirmar entrega
                  </button>
                )}
                <button onClick={() => onBill(order)}
                  className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted">
                  <DollarSign className="h-4 w-4" />Conta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CallCard({ call, onResolve }: { call: Call; onResolve: (id: string) => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 shadow-card">
      <div className="relative shrink-0">
        <Bell className="h-5 w-5 text-amber-500" />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-ping" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">Mesa {call.table_number} chamou</div>
        <div className="text-xs text-muted-foreground">{call.reason} · {timeAgo(call.created_at)}</div>
      </div>
      <button onClick={() => onResolve(call.id)}
        className="shrink-0 h-8 px-3 rounded-lg gradient-brand text-xs font-bold text-primary-foreground shadow-brand">
        Atender
      </button>
    </motion.div>
  );
}

type Tab = "pedidos" | "chamados";

function GarcomPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls,  setCalls]  = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pedidos");
  const [filterStatus, setFilter] = useState<"all" | "ready">("all");
  const [billOrder, setBillOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const [{ data: ordersRaw }, { data: callsRaw }] = await Promise.all([
      supabase.from("orders")
        .select("id,status,created_at,notes,total,type,table_id,order_items(id,name_snapshot,quantity,price_snapshot,notes),suborders(id,customer_name,customer_phone,total,paid)")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["new","preparing","ready","out_for_delivery"])
        .order("created_at", { ascending: false }),
      supabase.from("waiter_calls")
        .select("id,reason,created_at,table_id")
        .eq("restaurant_id", restaurant.id)
        .eq("resolved", false)
        .order("created_at"),
    ]);

    const tableIds = [...new Set([
      ...(ordersRaw ?? []).map(o => o.table_id),
      ...(callsRaw ?? []).map(c => c.table_id),
    ].filter(Boolean))] as string[];
    let tableMap: Record<string, number> = {};
    if (tableIds.length) {
      const { data: tbs } = await supabase.from("tables").select("id,number").in("id", tableIds);
      tableMap = Object.fromEntries((tbs ?? []).map(t => [t.id, t.number]));
    }

    setOrders((ordersRaw ?? []).map(o => ({
      ...o, status: o.status as OrderStatus,
      table_number: o.table_id ? tableMap[o.table_id] ?? null : null,
      order_items: (o.order_items as OrderItem[]) ?? [],
      suborders: (o.suborders as Suborder[]) ?? [],
    })));
    setCalls((callsRaw ?? []).map(c => ({ ...c, table_number: tableMap[c.table_id] ?? 0 })));
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`waiter-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders",       filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const deliver = async (id: string) => {
    setBusy(true);
    await supabase.from("orders").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", id);
    toast.success("Entrega confirmada!");
    void load(); setBusy(false);
  };

  const resolveCall = async (id: string) => {
    await supabase.from("waiter_calls").update({ resolved: true }).eq("id", id);
    toast.success("Chamado resolvido");
    void load();
  };

  const shown = filterStatus === "ready" ? orders.filter(o => o.status === "ready") : orders;
  const readyCount = orders.filter(o => o.status === "ready").length;

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/40"><HandPlatter className="h-4 w-4 text-accent-foreground" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
              <h1 className="text-xl font-extrabold tracking-tight">Painel do Garçom</h1>
            </div>
          </div>
          <button onClick={() => void load()} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-2">
          {(["pedidos","chamados"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex items-center gap-2 rounded-xl px-4 h-9 text-sm font-semibold capitalize transition-all",
                tab === t ? "gradient-brand text-primary-foreground shadow-brand" : "border border-border text-muted-foreground hover:bg-muted")}>
              {t === "chamados"
                ? <><Bell className="h-3.5 w-3.5" />Chamados{calls.length > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs">{calls.length}</span>}</>
                : <>Pedidos ({orders.length})</>}
            </button>
          ))}
        </div>
        {/* Filter */}
        {tab === "pedidos" && (
          <div className="flex gap-2">
            {(["all","ready"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("rounded-xl px-3 h-8 text-xs font-semibold transition-all",
                  filterStatus === f ? "gradient-brand text-primary-foreground shadow-brand" : "border border-border text-muted-foreground hover:bg-muted")}>
                {f === "all" ? `Todos (${orders.length})` : `Prontos${readyCount > 0 ? ` (${readyCount})` : ""}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-3">
        <AnimatePresence mode="popLayout">
          {tab === "chamados"
            ? calls.length === 0
              ? <motion.div key="no-calls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center py-20 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum chamado pendente 🎉</p>
                </motion.div>
              : calls.map(c => <CallCard key={c.id} call={c} onResolve={resolveCall} />)
            : shown.length === 0
              ? <motion.div key="no-orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid place-items-center py-20 text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{filterStatus === "ready" ? "Nenhum pedido pronto" : "Nenhum pedido ativo"}</p>
                </motion.div>
              : shown.map(o => <OrderRow key={o.id} order={o} onDeliver={id => { setBusy(true); void deliver(id); }} onBill={setBillOrder} />)
          }
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {billOrder && <BillModal order={billOrder} onClose={() => setBillOrder(null)} onDone={load} />}
      </AnimatePresence>

      {/* suppress unused */}
      {void busy}
      {void X}
    </div>
  );
}
