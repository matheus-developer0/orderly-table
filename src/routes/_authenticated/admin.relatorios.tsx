import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Calendar, Star, Award, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { restaurant } = useAuth();
  const [series, setSeries] = useState<{ day: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; total: number }[]>([]);
  const [hourly, setHourly] = useState<{ hour: string; orders: number }[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, orders: 0, avg: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurant) return;
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);

    const { data: orders } = await supabase
      .from("orders")
      .select("id,total,created_at,order_items(name_snapshot,quantity,price_snapshot)")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", start.toISOString())
      .neq("status", "cancelled");

    const list = orders ?? [];
    // Daily series
    const days: Record<string, { revenue: number; orders: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days[key] = { revenue: 0, orders: 0 };
    }
    const hours: Record<string, number> = {};
    for (let i = 8; i <= 23; i++) hours[`${i}h`] = 0;

    const productMap: Record<string, { qty: number; total: number }> = {};

    for (const o of list) {
      const key = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (days[key]) { days[key].revenue += Number(o.total); days[key].orders += 1; }
      const h = `${new Date(o.created_at).getHours()}h`;
      if (h in hours) hours[h] += 1;
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      for (const it of items) {
        const name = it.name_snapshot;
        if (!productMap[name]) productMap[name] = { qty: 0, total: 0 };
        productMap[name].qty += it.quantity;
        productMap[name].total += Number(it.price_snapshot) * it.quantity;
      }
    }

    setSeries(Object.entries(days).map(([day, v]) => ({ day, ...v })));
    setHourly(Object.entries(hours).map(([hour, orders]) => ({ hour, orders })));
    setTopProducts(
      Object.entries(productMap)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8),
    );
    const totalRev = list.reduce((s, o) => s + Number(o.total), 0);
    setTotals({ revenue: totalRev, orders: list.length, avg: list.length ? totalRev / list.length : 0 });
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-8 p-6 lg:p-10">
      <header className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Analytics</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Performance dos últimos 7 dias</p>
      </header>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Faturamento (7d)", value: fmt(totals.revenue), icon: TrendingUp },
          { label: "Pedidos (7d)", value: String(totals.orders), icon: Calendar },
          { label: "Ticket médio", value: fmt(totals.avg), icon: Award },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary mb-3">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-2xl font-extrabold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue chart */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Faturamento por dia</h2>
        </div>
        {loading ? <div className="h-64 bg-muted animate-pulse rounded-xl" /> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => fmt(v)}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hourly */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pedidos por horário</h2>
          </div>
          {loading ? <div className="h-56 bg-muted animate-pulse rounded-xl" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Top products */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Mais vendidos</h2>
          </div>
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-xl" />)}</div> :
            topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados ainda.</p>
            ) : (
              <ul className="space-y-2">
                {topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span className="flex-1 truncate font-medium text-sm">{p.name}</span>
                    <span className="text-xs font-bold text-muted-foreground">{p.qty}×</span>
                    <span className="text-sm font-extrabold">{fmt(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </div>
  );
}
