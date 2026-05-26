import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, ShoppingBag, Receipt, Users, RefreshCw, Download, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({ component: RelatoriosPage });

type DayBucket = { date: string; label: string; revenue: number; orders: number; cancelled: number };
type TopProduct = { name: string; qty: number; revenue: number };

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, b: number) => b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`;

function RelatoriosPage() {
  const { restaurant } = useAuth();
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [days, setDays] = useState<DayBucket[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [summary, setSummary] = useState({ revenue: 0, orders: 0, avgTicket: 0, cancelRate: 0, deliveryPct: 0, dineInPct: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);

    const from = new Date();
    from.setDate(from.getDate() - period);
    from.setHours(0, 0, 0, 0);

    const { data: orders } = await supabase
      .from("orders")
      .select("id,status,total,created_at,type,order_items(id,name_snapshot,quantity,price_snapshot)")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", from.toISOString())
      .order("created_at");

    const all = orders ?? [];
    const completed = all.filter(o => o.status !== "cancelled");
    const cancelled = all.filter(o => o.status === "cancelled");

    // Daily buckets
    const bucketMap: Record<string, DayBucket> = {};
    for (let i = 0; i < period; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      bucketMap[key] = { date: key, label, revenue: 0, orders: 0, cancelled: 0 };
    }
    for (const o of all) {
      const key = o.created_at.slice(0, 10);
      if (!bucketMap[key]) continue;
      if (o.status !== "cancelled") { bucketMap[key].revenue += Number(o.total); bucketMap[key].orders++; }
      else bucketMap[key].cancelled++;
    }
    const bucketsArr = Object.values(bucketMap);
    setDays(bucketsArr);

    // Top products
    const prodMap: Record<string, TopProduct> = {};
    for (const o of completed) {
      for (const item of (o.order_items as { name_snapshot: string; quantity: number; price_snapshot: number }[]) ?? []) {
        if (!prodMap[item.name_snapshot]) prodMap[item.name_snapshot] = { name: item.name_snapshot, qty: 0, revenue: 0 };
        prodMap[item.name_snapshot].qty += item.quantity;
        prodMap[item.name_snapshot].revenue += item.price_snapshot * item.quantity;
      }
    }
    const top = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
    setTopProducts(top);

    const totalRev = completed.reduce((s, o) => s + Number(o.total), 0);
    const deliveries = completed.filter(o => o.type === "delivery").length;
    setSummary({
      revenue: totalRev,
      orders: completed.length,
      avgTicket: completed.length > 0 ? totalRev / completed.length : 0,
      cancelRate: all.length > 0 ? (cancelled.length / all.length) * 100 : 0,
      deliveryPct: completed.length > 0 ? (deliveries / completed.length) * 100 : 0,
      dineInPct: completed.length > 0 ? ((completed.length - deliveries) / completed.length) * 100 : 0,
    });
    setLoading(false);
  }, [restaurant, period]);

  useEffect(() => { void load(); }, [load]);

  const maxRev = Math.max(...days.map(d => d.revenue), 1);
  const maxOrd = Math.max(...days.map(d => d.orders), 1);

  const exportCSV = () => {
    const header = "Data,Faturamento,Pedidos,Cancelamentos";
    const rows = days.map(d => `${d.date},${d.revenue.toFixed(2)},${d.orders},${d.cancelled}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${period}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Analytics</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Relatórios</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period selector */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              {([7, 14, 30] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn("px-3 h-9 text-xs font-semibold transition-all", period === p ? "gradient-brand text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {p}d
                </button>
              ))}
            </div>
            <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={exportCSV} className="flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted">
              <Download className="h-3.5 w-3.5" />CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[
                { label: "Faturamento total", value: fmt(summary.revenue), icon: TrendingUp, sub: `últimos ${period} dias` },
                { label: "Pedidos realizados", value: String(summary.orders), icon: ShoppingBag, sub: `${summary.cancelRate.toFixed(1)}% cancelamento` },
                { label: "Ticket médio", value: fmt(summary.avgTicket), icon: Receipt, sub: "por pedido" },
                { label: "Delivery", value: pct(summary.deliveryPct / 100 * summary.orders, summary.orders), icon: Users, sub: `${summary.dineInPct.toFixed(0)}% mesa` },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5 shadow-card">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary mb-4"><Icon className="h-4 w-4" /></div>
                    <div className="text-2xl font-extrabold tracking-tight">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">{s.sub}</div>
                  </motion.div>
                );
              })}
            </div>

            {/* Revenue bar chart */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Faturamento por dia</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />últimos {period} dias</span>
              </div>
              <div className="flex items-end gap-1.5 h-36 overflow-x-auto pb-2">
                {days.map(d => (
                  <div key={d.date} className="flex-1 min-w-[24px] flex flex-col items-center gap-1 group">
                    <div className="relative w-full">
                      <div className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors cursor-default"
                        style={{ height: `${Math.max((d.revenue / maxRev) * 100, d.revenue > 0 ? 4 : 0)}px` }}>
                        {d.revenue > 0 && (
                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-lg bg-card border border-border px-2 py-1 text-[10px] font-bold shadow-lg z-10">
                            {fmt(d.revenue)}<br />{d.orders} pedido{d.orders !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label.split(",")[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Orders + cancelled chart */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="font-bold mb-4 flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-muted-foreground" />Pedidos vs Cancelamentos por dia</h3>
              <div className="space-y-2">
                {days.filter(d => d.orders > 0 || d.cancelled > 0).slice(-14).map(d => (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-muted-foreground">{d.label}</span>
                    <div className="flex-1 flex gap-1 h-5">
                      {d.orders > 0 && (
                        <div className="rounded-sm bg-primary/70 flex items-center justify-center text-[9px] text-white font-bold"
                          style={{ width: `${(d.orders / (maxOrd)) * 100}%`, minWidth: "20px" }}>
                          {d.orders}
                        </div>
                      )}
                      {d.cancelled > 0 && (
                        <div className="rounded-sm bg-destructive/50 flex items-center justify-center text-[9px] text-white font-bold"
                          style={{ width: `${(d.cancelled / maxOrd) * 20}%`, minWidth: "16px" }}>
                          {d.cancelled}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/70" />Pedidos</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/50" />Cancelamentos</span>
              </div>
            </div>

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <h3 className="font-bold mb-4 flex items-center gap-2">🏆 Produtos mais vendidos</h3>
                <div className="space-y-3">
                  {topProducts.map((p, i) => {
                    const maxQty = topProducts[0].qty;
                    return (
                      <div key={p.name} className="flex items-center gap-3">
                        <span className={cn("shrink-0 w-6 text-xs font-black", i < 3 ? "text-primary" : "text-muted-foreground")}>#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.qty} un · {fmt(p.revenue)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-border font-bold">Detalhamento por dia</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Data</th>
                    <th className="px-5 py-3 text-right">Pedidos</th>
                    <th className="px-5 py-3 text-right">Cancelados</th>
                    <th className="px-5 py-3 text-right">Taxa cancel.</th>
                    <th className="px-5 py-3 text-right">Faturamento</th>
                    <th className="px-5 py-3 text-right">Ticket médio</th>
                  </tr></thead>
                  <tbody>
                    {days.slice().reverse().map((d, i) => (
                      <tr key={d.date} className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "" : "bg-muted/5")}>
                        <td className="px-5 py-3 font-medium">{d.label}</td>
                        <td className="px-5 py-3 text-right">{d.orders}</td>
                        <td className="px-5 py-3 text-right text-destructive">{d.cancelled || "—"}</td>
                        <td className="px-5 py-3 text-right">{pct(d.cancelled, d.orders + d.cancelled)}</td>
                        <td className="px-5 py-3 text-right font-semibold">{d.revenue > 0 ? fmt(d.revenue) : "—"}</td>
                        <td className="px-5 py-3 text-right">{d.orders > 0 ? fmt(d.revenue / d.orders) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-muted/30 font-bold">
                    <td className="px-5 py-3">TOTAL</td>
                    <td className="px-5 py-3 text-right">{summary.orders}</td>
                    <td className="px-5 py-3 text-right text-destructive">{days.reduce((s, d) => s + d.cancelled, 0) || "—"}</td>
                    <td className="px-5 py-3 text-right">{summary.cancelRate.toFixed(1)}%</td>
                    <td className="px-5 py-3 text-right text-primary">{fmt(summary.revenue)}</td>
                    <td className="px-5 py-3 text-right">{fmt(summary.avgTicket)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
