import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, CreditCard, Banknote, QrCode, DollarSign, FileText, Lock, Unlock, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/caixa")({
  component: CaixaPage,
});

type Session = {
  id: string;
  opened_at: string;
  opening_amount: number;
  closed_at: string | null;
  closing_amount: number | null;
  notes: string | null;
};

function CaixaPage() {
  const { restaurant, user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [data, setData] = useState({ revenue: 0, count: 0, dine_in: 0, delivery: 0, takeout: 0 });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);

  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);

    const [openRes, histRes, ordersRes] = await Promise.all([
      supabase.from("cash_sessions").select("*").eq("restaurant_id", restaurant.id).is("closed_at", null).order("opened_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("cash_sessions").select("*").eq("restaurant_id", restaurant.id).not("closed_at", "is", null).order("closed_at", { ascending: false }).limit(5),
      supabase.from("orders").select("total,type").eq("restaurant_id", restaurant.id).gte("created_at", todayStart.toISOString()).neq("status", "cancelled"),
    ]);

    setSession((openRes.data as Session) ?? null);
    setHistory((histRes.data ?? []) as Session[]);
    const list = ordersRes.data ?? [];
    const sum = (t: string) => list.filter((o) => o.type === t).reduce((s, o) => s + Number(o.total), 0);
    setData({
      revenue: list.reduce((s, o) => s + Number(o.total), 0),
      count: list.length,
      dine_in: sum("dine_in"),
      delivery: sum("delivery"),
      takeout: sum("takeout"),
    });
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalCaixa = (session?.opening_amount ?? 0) + data.revenue;

  return (
    <div className="space-y-8 p-6 lg:p-10">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Financeiro</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Caixa do dia</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => setDialog(session ? "close" : "open")}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-all ${
            session ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {session ? <><Lock className="h-4 w-4" /> Fechar caixa</> : <><Unlock className="h-4 w-4" /> Abrir caixa</>}
        </button>
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl gradient-brand p-8 text-primary-foreground shadow-elevated">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-80">
          <Wallet className="h-3.5 w-3.5" /> {session ? "Total em caixa agora" : "Caixa fechado"}
        </div>
        <div className="mt-2 text-5xl font-black tracking-tight">{loading ? "—" : fmt(totalCaixa)}</div>
        <div className="mt-3 text-sm opacity-80">
          {session ? (
            <>Abertura: {fmt(session.opening_amount)} · Vendas: {fmt(data.revenue)} · {data.count} pedidos · Desde {new Date(session.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
          ) : (
            <>Abra o caixa para começar a operar o dia</>
          )}
        </div>
      </motion.div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Salão", value: data.dine_in, icon: TrendingUp },
          { label: "Delivery", value: data.delivery, icon: Banknote },
          { label: "Balcão / retirada", value: data.takeout, icon: CreditCard },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary mb-3">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl font-extrabold">{fmt(s.value)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Estimativa por forma de pagamento</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pix", icon: QrCode, value: data.revenue * 0.45, color: "text-emerald-600 bg-emerald-500/10" },
            { label: "Crédito", icon: CreditCard, value: data.revenue * 0.30, color: "text-blue-600 bg-blue-500/10" },
            { label: "Débito", icon: CreditCard, value: data.revenue * 0.15, color: "text-purple-600 bg-purple-500/10" },
            { label: "Dinheiro", icon: DollarSign, value: data.revenue * 0.10, color: "text-amber-600 bg-amber-500/10" },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${p.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">~estimado</span>
                </div>
                <div className="mt-3 text-lg font-extrabold">{fmt(p.value)}</div>
                <div className="text-xs text-muted-foreground">{p.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Últimos fechamentos</h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-semibold">
                    {new Date(h.opened_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {" · "}
                    {new Date(h.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {" → "}
                    {h.closed_at && new Date(h.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {h.notes && <div className="text-xs text-muted-foreground mt-0.5">{h.notes}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Fechamento</div>
                  <div className="font-bold">{fmt(Number(h.closing_amount ?? 0))}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">Relatório do dia</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ao fechar o caixa, geramos o registro completo: abertura, vendas e fechamento.
            </p>
          </div>
        </div>
      </section>

      {dialog && (
        <CashDialog
          mode={dialog}
          restaurantId={restaurant!.id}
          userId={user?.id ?? null}
          currentSession={session}
          revenue={data.revenue}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); void load(); }}
        />
      )}
    </div>
  );
}

function CashDialog({ mode, restaurantId, userId, currentSession, revenue, onClose, onDone }: {
  mode: "open" | "close";
  restaurantId: string;
  userId: string | null;
  currentSession: Session | null;
  revenue: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(mode === "open" ? "200" : String(((currentSession?.opening_amount ?? 0) + revenue).toFixed(2)));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    if (mode === "open") {
      const { error } = await supabase.from("cash_sessions").insert({
        restaurant_id: restaurantId,
        opened_by: userId,
        opening_amount: Number(amount) || 0,
        notes: notes || null,
      });
      setSaving(false);
      if (error) return toast.error("Erro ao abrir caixa");
      toast.success("Caixa aberto. Bom trabalho!");
    } else if (currentSession) {
      const { error } = await supabase.from("cash_sessions").update({
        closed_at: new Date().toISOString(),
        closing_amount: Number(amount) || 0,
        notes: notes || currentSession.notes,
      }).eq("id", currentSession.id);
      setSaving(false);
      if (error) return toast.error("Erro ao fechar caixa");
      toast.success("Caixa fechado! Relatório do dia salvo.");
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{mode === "open" ? "Abrir caixa" : "Fechar caixa"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {mode === "open" ? "Valor inicial em caixa (R$)" : "Valor final conferido (R$)"}
          </label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-4 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder={mode === "open" ? "Ex: Troco inicial" : "Ex: Sangria de R$ 100 às 14h"}
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void submit()} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "open" ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />)}
            Confirmar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
