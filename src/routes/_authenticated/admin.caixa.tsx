import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, CreditCard, Banknote, QrCode, DollarSign, FileText, Lock, Unlock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/caixa")({
  component: CaixaPage,
});

function CaixaPage() {
  const { restaurant } = useAuth();
  const [open, setOpen] = useState(true);
  const [openingAmount] = useState(200);
  const [data, setData] = useState({ revenue: 0, count: 0, dine_in: 0, delivery: 0, takeout: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const { data: orders } = await supabase
      .from("orders")
      .select("total,type")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", todayStart.toISOString())
      .neq("status", "cancelled");
    const list = orders ?? [];
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
  const totalCaixa = openingAmount + data.revenue;

  const closeCash = () => {
    setOpen(false);
    toast.success("Caixa fechado! Relatório do dia gerado.");
  };
  const openCash = () => {
    setOpen(true);
    toast.success("Caixa aberto. Bom trabalho!");
  };

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
          onClick={open ? closeCash : openCash}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-all ${
            open ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {open ? <><Lock className="h-4 w-4" /> Fechar caixa</> : <><Unlock className="h-4 w-4" /> Abrir caixa</>}
        </button>
      </header>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl gradient-brand p-8 text-primary-foreground shadow-elevated">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-80">
          <Wallet className="h-3.5 w-3.5" /> Total em caixa agora
        </div>
        <div className="mt-2 text-5xl font-black tracking-tight">{loading ? "—" : fmt(totalCaixa)}</div>
        <div className="mt-3 text-sm opacity-80">
          Abertura: {fmt(openingAmount)} · Vendas: {fmt(data.revenue)} · {data.count} pedidos
        </div>
      </motion.div>

      {/* Breakdown */}
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

      {/* Payment methods (mock) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Formas de pagamento (hoje)</h2>
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
                  <span className="text-xs text-muted-foreground">~estimado</span>
                </div>
                <div className="mt-3 text-lg font-extrabold">{fmt(p.value)}</div>
                <div className="text-xs text-muted-foreground">{p.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold">Relatório do dia</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ao fechar o caixa, geramos um relatório completo: vendas, sangrias, descontos e fechamento por forma de pagamento.
            </p>
          </div>
          <button className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Exportar PDF
          </button>
        </div>
      </section>
    </div>
  );
}
