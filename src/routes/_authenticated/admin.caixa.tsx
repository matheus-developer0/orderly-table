import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Plus, Loader2, X, Check, Lock, Unlock, Receipt, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/caixa")({ component: CaixaPage });

type Session = { id: string; opened_at: string; closed_at: string | null; opening_amount: number; closing_amount: number | null; notes: string | null; orders_total?: number; orders_count?: number };

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OpenModal({ restaurantId, userId, onClose, onOpened }: { restaurantId: string; userId: string; onClose: () => void; onOpened: () => void }) {
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const open = async () => {
    setSaving(true);
    const { error } = await supabase.from("cash_sessions").insert({
      restaurant_id: restaurantId, opened_by: userId,
      opening_amount: Number(amount), notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Caixa aberto!");
    onOpened(); onClose();
  };

  return (<>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" />
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Abrir caixa</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor inicial (troco) R$</label>
        <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} className="input-base text-xl font-bold" autoFocus />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-base resize-none" placeholder="Opcional..." />
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={() => void open()} disabled={saving}
          className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlock className="h-4 w-4" />Abrir</>}
        </button>
      </div>
    </motion.div>
  </>);
}

function CloseModal({ session, onClose, onClosed }: { session: Session; onClose: () => void; onClosed: () => void }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const expected = (session.opening_amount ?? 0) + (session.orders_total ?? 0);
  const diff = amount ? Number(amount) - expected : null;

  const close = async () => {
    if (!amount) return toast.error("Informe o valor em caixa");
    setSaving(true);
    const { error } = await supabase.from("cash_sessions").update({
      closed_at: new Date().toISOString(),
      closing_amount: Number(amount),
      notes: notes || null,
    }).eq("id", session.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Caixa fechado!");
    onClosed(); onClose();
  };

  return (<>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" />
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Fechar caixa</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Abertura</span><span className="font-semibold">{fmt(session.opening_amount)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Vendas ({session.orders_count ?? 0} pedidos)</span><span className="font-semibold text-success">+{fmt(session.orders_total ?? 0)}</span></div>
        <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Esperado em caixa</span><span>{fmt(expected)}</span></div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor real em caixa R$</label>
        <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} className="input-base text-xl font-bold" autoFocus placeholder="0,00" />
      </div>
      {diff !== null && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", diff >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
          {diff >= 0 ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {diff >= 0 ? `Sobra de ${fmt(diff)}` : `Falta de ${fmt(Math.abs(diff))}`}
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-base resize-none" placeholder="Opcional..." />
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={() => void close()} disabled={saving}
          className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4" />Fechar caixa</>}
        </button>
      </div>
    </motion.div>
  </>);
}

function CaixaPage() {
  const { restaurant, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState<Session | null>(null);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase.from("cash_sessions")
      .select("id,opened_at,closed_at,opening_amount,closing_amount,notes")
      .eq("restaurant_id", restaurant.id)
      .order("opened_at", { ascending: false })
      .limit(30);

    if (!data) return setLoading(false);

    // Enrich with orders totals per session
    const enriched: Session[] = await Promise.all(data.map(async s => {
      const from = s.opened_at;
      const to = s.closed_at ?? new Date().toISOString();
      const { data: orders } = await supabase.from("orders")
        .select("id,total")
        .eq("restaurant_id", restaurant.id)
        .neq("status", "cancelled")
        .gte("created_at", from)
        .lte("created_at", to);
      const orders_total = (orders ?? []).reduce((sum, o) => sum + Number(o.total), 0);
      return { ...s, orders_total, orders_count: (orders ?? []).length };
    }));

    setSessions(enriched);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const activeSession = sessions.find(s => !s.closed_at);
  const elapsed = (from: string) => {
    const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
    if (mins < 60) return `${mins}min aberto`;
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""} aberto`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financeiro</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Caixa</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeSession ? <span className="text-success font-semibold">● Caixa aberto — {elapsed(activeSession.opened_at)}</span> : "Caixa fechado"}
            </p>
          </div>
          {!activeSession ? (
            <button onClick={() => setOpenModal(true)}
              className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
              <Plus className="h-4 w-4" />Abrir caixa
            </button>
          ) : (
            <button onClick={() => setCloseModal(activeSession)}
              className="flex h-11 items-center gap-2 rounded-xl bg-destructive text-destructive-foreground px-4 text-sm font-bold hover:opacity-90 transition-opacity">
              <Lock className="h-4 w-4" />Fechar caixa
            </button>
          )}
        </div>
      </div>

      {/* Active session summary */}
      {activeSession && (
        <div className="px-6 py-4 border-b border-border bg-success/5 shrink-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-2xl">
            {[
              { label: "Abertura", value: fmt(activeSession.opening_amount) },
              { label: "Vendas", value: fmt(activeSession.orders_total ?? 0) },
              { label: "Pedidos", value: String(activeSession.orders_count ?? 0) },
              { label: "Total em caixa", value: fmt((activeSession.opening_amount ?? 0) + (activeSession.orders_total ?? 0)) },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-success/20 bg-card px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="text-lg font-extrabold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : sessions.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <Wallet className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-3">Nenhuma sessão de caixa ainda.</p>
            <button onClick={() => setOpenModal(true)} className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand">Abrir primeiro caixa</button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Histórico de sessões</h2>
            <AnimatePresence mode="popLayout">
              {sessions.map(s => {
                const isActive = !s.closed_at;
                const diff = s.closing_amount != null ? s.closing_amount - ((s.opening_amount ?? 0) + (s.orders_total ?? 0)) : null;
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={cn("rounded-2xl border bg-card shadow-card overflow-hidden", isActive ? "border-success/30 ring-1 ring-success/20" : "border-border")}>
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                        {isActive ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            {new Date(s.opened_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            {" "}
                            {new Date(s.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isActive
                            ? <span className="rounded-full bg-success/10 text-success px-2 py-0.5 text-[10px] font-bold">ABERTO</span>
                            : <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold">FECHADO</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Receipt className="h-3 w-3" />{s.orders_count ?? 0} pedidos</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Abertura: {fmt(s.opening_amount)}</span>
                          {s.notes && <span>• {s.notes}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold">{fmt(s.orders_total ?? 0)}</div>
                        <div className="text-xs text-muted-foreground">vendas</div>
                        {diff !== null && (
                          <div className={cn("text-xs font-bold mt-0.5", diff >= 0 ? "text-success" : "text-destructive")}>
                            {diff >= 0 ? `+${fmt(diff)}` : fmt(diff)}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {openModal && restaurant && user && (
          <OpenModal restaurantId={restaurant.id} userId={user.id} onClose={() => setOpenModal(false)} onOpened={load} />
        )}
        {closeModal && (
          <CloseModal session={closeModal} onClose={() => setCloseModal(null)} onClosed={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
