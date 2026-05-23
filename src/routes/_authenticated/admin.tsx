import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, ShoppingBag, Receipt, Users,
  ArrowUpRight, ChefHat, Bell, Clock,
  CheckCircle2, XCircle, AlertCircle, Utensils,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

type DashStats = {
  revenue: number;
  orders: number;
  avgTicket: number;
  activeTables: number;
  revenueChange: number;
  ordersChange: number;
};

type RecentOrder = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  table_number: number | null;
  type: string;
  item_count: number;
};

type ActiveTable = {
  id: string;
  number: number;
  status: string;
  order_total: number;
  since: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  preparing: "Preparando",
  ready: "Pronto",
  out_for_delivery: "Saiu",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  new: "bg-yellow-500/10 text-yellow-600",
  preparing: "bg-blue-500/10 text-blue-600",
  ready: "bg-green-500/10 text-green-600",
  out_for_delivery: "bg-purple-500/10 text-purple-600",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function StatCard({ label, value, change, icon: Icon, positive }: {
  label: string; value: string; change: string; icon: React.ElementType; positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn("text-[10px] font-bold", positive === false ? "text-destructive" : "text-success")}>
          {change}
        </span>
      </div>
      <div className="mt-4 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AdminDashboard() {
  const { restaurant } = useAuth();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [activeTables, setActiveTables] = useState<ActiveTable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurant) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const [
      { data: todayOrders },
      { data: yesterdayOrders },
      { data: activeOrdersRaw },
      { data: tablesRaw },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id,total,status,created_at,type,table_id,order_items(id)")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", todayStart.toISOString())
        .neq("status", "cancelled"),
      supabase
        .from("orders")
        .select("id,total")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", yesterdayStart.toISOString())
        .lt("created_at", todayStart.toISOString())
        .neq("status", "cancelled"),
      supabase
        .from("orders")
        .select("id,status,total,created_at,type,table_id,order_items(id)")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["new", "preparing", "ready", "out_for_delivery"])
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("tables")
        .select("id,number,status")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["occupied", "bill_requested"]),
    ]);

    // Stats
    const todayRevenue = (todayOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const yestRevenue = (yesterdayOrders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const revenueChange = yestRevenue === 0 ? 0 : ((todayRevenue - yestRevenue) / yestRevenue) * 100;
    const todayCount = (todayOrders ?? []).length;
    const yestCount = (yesterdayOrders ?? []).length;
    const ordersChange = yestCount === 0 ? 0 : ((todayCount - yestCount) / yestCount) * 100;

    setStats({
      revenue: todayRevenue,
      orders: todayCount,
      avgTicket: todayCount > 0 ? todayRevenue / todayCount : 0,
      activeTables: (tablesRaw ?? []).length,
      revenueChange,
      ordersChange,
    });

    // Get table numbers for recent orders
    const allOrders = activeOrdersRaw ?? [];
    const tableIds = [...new Set(allOrders.map((o) => o.table_id).filter(Boolean))] as string[];
    let tableMap: Record<string, number> = {};
    if (tableIds.length > 0) {
      const { data: tbs } = await supabase.from("tables").select("id,number").in("id", tableIds);
      tableMap = Object.fromEntries((tbs ?? []).map((t) => [t.id, t.number]));
    }

    setRecentOrders(
      allOrders.map((o) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        created_at: o.created_at,
        table_number: o.table_id ? tableMap[o.table_id] ?? null : null,
        type: o.type,
        item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
      })),
    );

    // Active tables with latest order info
    const occupiedIds = (tablesRaw ?? []).map((t) => t.id);
    let tableOrderMap: Record<string, { total: number; since: string }> = {};
    if (occupiedIds.length > 0) {
      const { data: latestOrders } = await supabase
        .from("orders")
        .select("table_id,total,created_at")
        .in("table_id", occupiedIds)
        .in("status", ["new", "preparing", "ready"])
        .order("created_at", { ascending: false });
      for (const o of latestOrders ?? []) {
        if (o.table_id && !tableOrderMap[o.table_id]) {
          tableOrderMap[o.table_id] = { total: Number(o.total), since: o.created_at };
        }
      }
    }

    setActiveTables(
      (tablesRaw ?? []).map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        order_total: tableOrderMap[t.id]?.total ?? 0,
        since: tableOrderMap[t.id]?.since ?? null,
      })),
    );

    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase
      .channel(`dashboard-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const changeLabel = (n: number) =>
    n === 0 ? "igual a ontem" : `${n > 0 ? "+" : ""}${n.toFixed(0)}% vs ontem`;

  return (
    <div className="space-y-8 p-6 lg:p-10">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dashboard</div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {restaurant?.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </motion.header>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Faturamento hoje", value: fmt(stats?.revenue ?? 0), change: changeLabel(stats?.revenueChange ?? 0), icon: TrendingUp, positive: (stats?.revenueChange ?? 0) >= 0 },
            { label: "Pedidos do dia", value: String(stats?.orders ?? 0), change: changeLabel(stats?.ordersChange ?? 0), icon: ShoppingBag, positive: (stats?.ordersChange ?? 0) >= 0 },
            { label: "Ticket médio", value: fmt(stats?.avgTicket ?? 0), change: "hoje", icon: Receipt, positive: true },
            { label: "Mesas ocupadas", value: String(stats?.activeTables ?? 0), change: "agora", icon: Users, positive: true },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <StatCard {...s} />
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active orders */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pedidos ativos</h2>
            <Link to="/cozinha" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver cozinha <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : recentOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum pedido ativo no momento</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <motion.div key={o.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
                  <div className={cn("rounded-full p-1.5", STATUS_COLOR[o.status] ?? "bg-muted text-muted-foreground")}>
                    {o.status === "new" ? <AlertCircle className="h-3.5 w-3.5" /> :
                      o.status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                        o.status === "cancelled" ? <XCircle className="h-3.5 w-3.5" /> :
                          <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {o.table_number ? `Mesa ${o.table_number}` : o.type === "delivery" ? "Delivery" : "Balcão"}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_COLOR[o.status])}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.item_count} {o.item_count === 1 ? "item" : "itens"} · {timeAgo(o.created_at)}
                    </div>
                  </div>
                  <div className="font-extrabold text-sm shrink-0">{fmt(o.total)}</div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Active tables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Mesas ocupadas</h2>
            <Link to="/admin/mesas" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Gerenciar <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : activeTables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Utensils className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma mesa ocupada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTables.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
                  <div className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black",
                    t.status === "bill_requested" ? "bg-amber-500/10 text-amber-600" : "gradient-brand text-primary-foreground",
                  )}>
                    {t.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">
                      {t.status === "bill_requested" ? "⚠️ Conta solicitada" : "Ocupada"}
                    </div>
                    {t.since && <div className="text-[11px] text-muted-foreground">{timeAgo(t.since)} atrás</div>}
                  </div>
                  {t.order_total > 0 && <div className="text-xs font-bold shrink-0">{fmt(t.order_total)}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Acesso rápido</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/admin/produtos", label: "Cardápio", desc: "Produtos, categorias e preços", icon: "🍕" },
            { to: "/admin/mesas", label: "Mesas & QR", desc: "Gere e gerencie QR codes", icon: "🪑" },
            { to: "/cozinha", label: "Cozinha", desc: "Kanban de pedidos em tempo real", icon: "👨‍🍳" },
            { to: "/garcom", label: "Garçom", desc: "Chamados, pedidos e contas", icon: "🛎️" },
          ].map((item, i) => (
            <motion.div key={item.to} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Link to={item.to}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-4 font-bold">{item.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.desc}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
