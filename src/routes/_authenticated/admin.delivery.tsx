import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bike, MapPin, Phone, Clock, CheckCircle2, Loader2,
  Package, Plus, X, Check, RefreshCw, User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/delivery")({ component: DeliveryPage });

type DeliveryStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "delivered";
type DeliveryOrder = {
  id: string; status: DeliveryStatus; total: number; created_at: string;
  notes: string | null; customer_name: string | null; customer_phone: string | null;
  delivery_address: string | null; item_count: number;
};

const COLS: { key: DeliveryStatus; label: string; color: string; dot: string }[] = [
  { key: "new",              label: "Recebidos",      color: "border-yellow-500/30 bg-yellow-500/5", dot: "bg-yellow-500" },
  { key: "preparing",        label: "Preparando",     color: "border-blue-500/30 bg-blue-500/5",    dot: "bg-blue-500" },
  { key: "ready",            label: "Pronto p/ envio",color: "border-green-500/30 bg-green-500/5",  dot: "bg-green-500" },
  { key: "out_for_delivery", label: "Em rota",        color: "border-purple-500/30 bg-purple-500/5",dot: "bg-purple-500" },
  { key: "delivered",        label: "Entregues",      color: "border-border bg-muted/20",           dot: "bg-muted-foreground" },
];

const NEXT: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  new: "preparing", preparing: "ready", ready: "out_for_delivery", out_for_delivery: "delivered",
};
const NEXT_LABEL: Partial<Record<DeliveryStatus, string>> = {
  new: "Iniciar preparo", preparing: "Pronto", ready: "Despachar", out_for_delivery: "Entregue ✓",
};

function NewDeliveryModal({ restaurantId, onClose, onSaved }: {
  restaurantId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", total: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || !form.address.trim()) return toast.error("Nome e endereço são obrigatórios");
    if (!form.total || isNaN(Number(form.total))) return toast.error("Valor inválido");
    setSaving(true);
    const { data: order, error } = await supabase.from("orders").insert({
      restaurant_id: restaurantId, status: "new", type: "delivery",
      total: Number(form.total), notes: form.address.trim() || null,
      customer_name: form.name.trim(), customer_phone: form.phone.trim() || null,
      delivery_address: form.address.trim(),
    }).select("id").maybeSingle();
    setSaving(false);
    if (error || !order) return toast.error("Erro ao criar pedido");
    toast.success("Pedido de delivery criado!");
    onSaved(); onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">Novo pedido delivery</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          {[
            { label: "Nome do cliente *", key: "name", icon: User, placeholder: "João Silva" },
            { label: "Telefone", key: "phone", icon: Phone, placeholder: "(11) 99999-9999" },
            { label: "Endereço de entrega *", key: "address", icon: MapPin, placeholder: "Rua Exemplo, 123 - Bairro" },
            { label: "Valor total (R$) *", key: "total", icon: null, placeholder: "0.00" },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{f.label}</label>
              <div className="relative">
                {f.icon && <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                <input
                  type={f.key === "total" ? "number" : "text"}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={cn("input-base", f.icon && "pl-9")}
                  placeholder={f.placeholder}
                />
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} className="input-base resize-none" placeholder="Sem cebola, portão azul..." />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Criar pedido</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function DeliveryCard({ order, onAdvance }: { order: DeliveryOrder; onAdvance: (id: string, next: DeliveryStatus) => void }) {
  const next = NEXT[order.status];
  const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isLate = mins > 45 && order.status !== "delivered";
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className={cn("rounded-2xl bg-card border border-border shadow-card p-4 space-y-3", isLate && "ring-1 ring-red-500/40")}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">#{order.id.slice(0, 8)}</span>
        <span className={cn("flex items-center gap-1 text-[10px] font-bold", isLate ? "text-red-500" : "text-muted-foreground")}>
          <Clock className="h-3 w-3" />{Math.floor(mins)}min{isLate && " ⚠️"}
        </span>
      </div>

      {order.customer_name && (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {order.customer_name}
        </div>
      )}

      {(order.delivery_address || order.notes) && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{order.delivery_address ?? order.notes}</span>
        </div>
      )}

      {order.customer_phone && (
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
          <Phone className="h-3.5 w-3.5" />{order.customer_phone}
        </a>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="font-extrabold text-sm">{fmt(order.total)}</span>
        {next && (
          <button onClick={() => onAdvance(order.id, next)}
            className="h-8 rounded-lg gradient-brand px-3 text-[11px] font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
            {NEXT_LABEL[order.status]}
          </button>
        )}
        {order.status === "delivered" && (
          <span className="flex items-center gap-1 text-xs text-success font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />Entregue
          </span>
        )}
      </div>
    </motion.div>
  );
}

function DeliveryPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("orders")
      .select("id,status,total,created_at,notes,customer_name,customer_phone,delivery_address,order_items(id)")
      .eq("restaurant_id", restaurant.id)
      .eq("type", "delivery")
      .gte("created_at", today.toISOString())
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    setOrders((data ?? []).map(o => ({
      ...o, status: o.status as DeliveryStatus,
      item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
    })));
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

  const advance = async (id: string, next: DeliveryStatus) => {
    const { error } = await supabase.from("orders").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Erro ao atualizar");
    else void load();
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const today_revenue = orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Bike className="h-7 w-7 text-primary" />Delivery
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border bg-background px-4 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Entregues hoje</div>
              <div className="text-lg font-extrabold">{fmt(today_revenue)}</div>
            </div>
            <button onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => setNewModal(true)}
              className="flex h-10 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
              <Plus className="h-4 w-4" />Novo pedido
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-3">Nenhum pedido de delivery hoje.</p>
            <button onClick={() => setNewModal(true)}
              className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand">
              Criar primeiro pedido
            </button>
          </div>
        ) : (
          <div className="flex gap-4 min-w-max h-full">
            {COLS.map(col => {
              const items = orders.filter(o => o.status === col.key);
              return (
                <div key={col.key} className="w-72 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                    <span className="text-sm font-bold">{col.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{items.length}</span>
                  </div>
                  <div className={cn("flex-1 rounded-2xl border-2 p-3 space-y-3 min-h-[200px]", col.color)}>
                    <AnimatePresence mode="popLayout">
                      {items.length === 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="grid place-items-center py-10 text-xs text-muted-foreground">Nada aqui</motion.div>
                      )}
                      {items.map(o => <DeliveryCard key={o.id} order={o} onAdvance={advance} />)}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {newModal && restaurant && <NewDeliveryModal restaurantId={restaurant.id} onClose={() => setNewModal(false)} onSaved={load} />}
      </AnimatePresence>
    </div>
  );
}
