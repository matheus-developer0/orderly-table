import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChefHat, Clock, Loader2, AlertCircle, CheckCircle2, Bike, XCircle, RefreshCw, Printer, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cozinha")({ component: CozinhaPage });

type OrderStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";
type OrderItem = { id: string; name_snapshot: string; quantity: number; price_snapshot: number; notes: string | null };
type Order = { id: string; status: OrderStatus; created_at: string; notes: string | null; total: number; type: string; table_id: string | null; table_number?: number | null; order_items: OrderItem[]; printed: boolean };

const COLS = [
  { key: "new"              as OrderStatus, label: "Novos",   color: "text-yellow-500", bg: "bg-yellow-500/5 border-yellow-500/20" },
  { key: "preparing"        as OrderStatus, label: "Preparo", color: "text-blue-500",   bg: "bg-blue-500/5 border-blue-500/20" },
  { key: "ready"            as OrderStatus, label: "Pronto",  color: "text-green-500",  bg: "bg-green-500/5 border-green-500/20" },
  { key: "out_for_delivery" as OrderStatus, label: "Saiu",    color: "text-purple-500", bg: "bg-purple-500/5 border-purple-500/20" },
];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: "preparing", preparing: "ready", ready: "out_for_delivery", out_for_delivery: "delivered" };
const PREV: Partial<Record<OrderStatus, OrderStatus>> = { preparing: "new", ready: "preparing", out_for_delivery: "ready" };

function elapsed(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function CancelModal({ onConfirm, onClose }: { onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const REASONS = ["Produto em falta", "Pedido duplicado", "Cliente desistiu", "Erro no pedido", "Outro"];
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
        <h2 className="text-lg font-extrabold">Cancelar pedido</h2>
        <p className="text-sm text-muted-foreground -mt-2">Selecione ou escreva o motivo</p>
        <div className="space-y-2">
          {REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={cn("w-full rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-all",
                reason === r ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border hover:bg-muted")}>
              {r}
            </button>
          ))}
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Outro motivo..." className="input-base" />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Voltar</button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim()}
            className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-40">
            Cancelar pedido
          </button>
        </div>
      </motion.div>
    </>
  );
}

function OrderCard({ order, onAdvance, onBack, onCancel, onPrint, moving }: {
  order: Order;
  onAdvance: (id: string, s: OrderStatus) => void;
  onBack: (id: string, s: OrderStatus) => void;
  onCancel: (id: string) => void;
  onPrint: (o: Order) => void;
  moving: string | null;
}) {
  const next = NEXT[order.status];
  const prev = PREV[order.status];
  const isBusy = moving === order.id;
  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isLate = mins > 20;
  const isNew = order.status === "new";

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className={cn("rounded-2xl border bg-card p-4 shadow-card space-y-3 transition-all",
        isNew && "ring-2 ring-yellow-500/40",
        isLate && "ring-2 ring-red-500/40",
        isBusy && "opacity-60 pointer-events-none")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {order.table_number ? `Mesa ${order.table_number}` : order.type === "delivery" ? "🛵 Delivery" : "🥡 Balcão"}
          </div>
          <div className={cn("text-xs mt-0.5 flex items-center gap-1.5 font-medium", isLate ? "text-red-500" : "text-muted-foreground")}>
            <Clock className="h-3 w-3" />
            {elapsed(order.created_at)}
            {isLate && <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">ATRASADO</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onPrint(order)} title={order.printed ? "Reimprimir" : "Imprimir"}
            className={cn("grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-muted", order.printed ? "text-success" : "text-muted-foreground")}>
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onCancel(order.id)}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {order.order_items.map(item => (
          <li key={item.id} className="flex items-start gap-2">
            <span className="shrink-0 min-w-[22px] h-5 rounded bg-primary/10 text-primary text-[11px] font-bold grid place-items-center px-1">{item.quantity}x</span>
            <div>
              <span className="text-sm font-medium leading-tight">{item.name_snapshot}</span>
              {item.notes && <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">⚠️ {item.notes}</div>}
            </div>
          </li>
        ))}
      </ul>

      {order.notes && <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">📝 {order.notes}</div>}

      <div className="flex gap-2 pt-1">
        {prev && (
          <button onClick={() => onBack(order.id, prev)}
            className="flex-1 h-8 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            ← Voltar
          </button>
        )}
        {next && (
          <button onClick={() => onAdvance(order.id, next)} disabled={isBusy}
            className="flex-1 h-8 rounded-lg gradient-brand text-xs font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02] flex items-center justify-center">
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : next === "delivered" ? "✓ Entregue" : "Avançar →"}
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
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const prevNewIds = useRef<Set<string>>(new Set());

  const playSound = useCallback(() => {
    if (!soundOn) return;
    try {
      const ctx = new AudioContext();
      [880, 1100, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.1);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.12);
      });
    } catch {}
  }, [soundOn]);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase.from("orders")
      .select("id,status,created_at,notes,total,type,table_id,printed,order_items(id,name_snapshot,quantity,price_snapshot,notes)")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["new","preparing","ready","out_for_delivery"])
      .order("created_at");
    if (!data) return;

    const tableIds = [...new Set(data.map(o => o.table_id).filter(Boolean))] as string[];
    let tableMap: Record<string, number> = {};
    if (tableIds.length) {
      const { data: tbs } = await supabase.from("tables").select("id,number").in("id", tableIds);
      tableMap = Object.fromEntries((tbs ?? []).map(t => [t.id, t.number]));
    }

    const enriched = data.map(o => ({ ...o, table_number: o.table_id ? tableMap[o.table_id] ?? null : null, order_items: (o.order_items as OrderItem[]) ?? [] }));

    const newIds = new Set(enriched.filter(o => o.status === "new").map(o => o.id));
    let hasNew = false;
    for (const id of newIds) { if (!prevNewIds.current.has(id)) { hasNew = true; break; } }
    if (hasNew) playSound();
    prevNewIds.current = newIds;

    setOrders(enriched);
    setLoading(false);
  }, [restaurant, playSound]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`kitchen-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  // Atualiza elapsed a cada 30s sem refetch
  useEffect(() => {
    const t = setInterval(() => setOrders(o => [...o]), 30000);
    return () => clearInterval(t);
  }, []);

  const updateStatus = async (id: string, status: OrderStatus, cancelReason?: string) => {
    setMoving(id);
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (cancelReason) patch.cancel_reason = cancelReason;
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    setMoving(null);
    if (error) return toast.error(error.message);
    toast.success(status === "cancelled" ? "Pedido cancelado" : "Pedido atualizado");
    void load();
  };

  const printOrder = (order: Order) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const time = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    win.document.write(`<html><head><title>Pedido</title>
    <style>body{font-family:monospace;font-size:14px;padding:20px;max-width:300px;margin:0 auto}
    h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;font-size:18px}
    .item{margin:6px 0}.qty{font-weight:bold}.note{color:#666;font-size:12px;margin-left:16px}
    .obs{background:#f5f5f5;padding:6px 10px;border-radius:4px;font-size:12px;margin-top:8px}
    .total{border-top:2px dashed #000;margin-top:10px;padding-top:8px;font-weight:bold;display:flex;justify-content:space-between;font-size:16px}
    .sub{color:#666;font-size:12px;text-align:center;margin-top:4px}</style>
    </head><body>
    <h2>${order.table_number ? `MESA ${order.table_number}` : order.type === "delivery" ? "DELIVERY" : "BALCÃO"}</h2>
    <p style="text-align:center;color:#666;margin:4px 0">${time}</p>
    ${order.order_items.map(i => `<div class="item"><span class="qty">${i.quantity}x</span> ${i.name_snapshot}${i.notes ? `<div class="note">⚠ ${i.notes}</div>` : ""}</div>`).join("")}
    ${order.notes ? `<div class="obs">📝 ${order.notes}</div>` : ""}
    <div class="total"><span>TOTAL</span><span>R$ ${Number(order.total).toFixed(2).replace(".", ",")}</span></div>
    <div class="sub">#${order.id.slice(0, 8)}</div>
    </body></html>`);
    win.document.close();
    win.print();
    void supabase.from("orders").update({ printed: true }).eq("id", order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, printed: true } : o));
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
            <ChefHat className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Painel</div>
            <h1 className="text-xl font-extrabold tracking-tight">Cozinha</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orders.filter(o => o.status === "new").length > 0 && (
            <span className="rounded-full gradient-brand px-3 py-1 text-xs font-bold text-primary-foreground shadow-brand animate-pulse">
              {orders.filter(o => o.status === "new").length} novo{orders.filter(o => o.status === "new").length > 1 ? "s" : ""}
            </span>
          )}
          <button onClick={() => setSoundOn(v => !v)}
            className={cn("grid h-8 w-8 place-items-center rounded-lg border hover:bg-muted transition-colors", soundOn ? "border-primary/30 text-primary" : "border-border text-muted-foreground")}>
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => void load()} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLS.map(col => {
            const list = orders.filter(o => o.status === col.key);
            return (
              <div key={col.key} className="w-72 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn("h-2 w-2 rounded-full", col.key === "new" ? "bg-yellow-500" : col.key === "preparing" ? "bg-blue-500" : col.key === "ready" ? "bg-green-500" : "bg-purple-500")} />
                  <span className="text-sm font-bold">{col.label}</span>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{list.length}</span>
                </div>
                <div className={cn("flex-1 rounded-2xl border p-3 space-y-3 min-h-[200px]", col.bg)}>
                  <AnimatePresence mode="popLayout">
                    {list.length === 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="grid place-items-center py-12 text-xs text-muted-foreground">
                        Nenhum pedido
                      </motion.div>
                    )}
                    {list.map(order => (
                      <OrderCard key={order.id} order={order} moving={moving}
                        onAdvance={(id, s) => void updateStatus(id, s)}
                        onBack={(id, s) => void updateStatus(id, s)}
                        onCancel={id => setCancelTarget(id)}
                        onPrint={printOrder} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {cancelTarget && (
          <CancelModal
            onConfirm={reason => { void updateStatus(cancelTarget, "cancelled", reason); setCancelTarget(null); }}
            onClose={() => setCancelTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// suppress
void AlertCircle; void Bike; void CheckCircle2;
