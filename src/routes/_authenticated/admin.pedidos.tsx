import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Receipt, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: PedidosPage,
});

type Order = {
  id: string;
  status: string;
  type: string;
  total: number;
  created_at: string;
  table_id: string | null;
  notes: string | null;
};

const STATUS = {
  new: { label: "Novo", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30", icon: Clock },
  preparing: { label: "Preparando", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: Clock },
  ready: { label: "Pronto", color: "bg-green-500/10 text-green-700 border-green-500/30", icon: CheckCircle2 },
  out_for_delivery: { label: "Saiu", color: "bg-purple-500/10 text-purple-700 border-purple-500/30", icon: Clock },
  delivered: { label: "Entregue", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
} as const;

const FILTERS = ["all", "new", "preparing", "ready", "delivered", "cancelled"] as const;
type FilterKey = typeof FILTERS[number];

function PedidosPage() {
  const { restaurant } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("orders")
      .select("id,status,type,total,created_at,table_id,notes")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders(data ?? []);
    const { data: tbs } = await supabase.from("tables").select("id,number").eq("restaurant_id", restaurant.id);
    setTables(Object.fromEntries((tbs ?? []).map((t) => [t.id, t.number])));
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`pedidos-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const filtered = orders.filter((o) => {
    const matchFilter = filter === "all" || o.status === filter;
    const matchSearch = !search || o.id.toLowerCase().includes(search.toLowerCase()) || String(tables[o.table_id ?? ""] ?? "").includes(search);
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <header className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Histórico de pedidos</h1>
        <p className="text-sm text-muted-foreground">Todos os pedidos do restaurante em tempo real</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID ou mesa..."
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                filter === f ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted",
              )}>
              {f === "all" ? "Todos" : STATUS[f as keyof typeof STATUS]?.label ?? f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border p-16 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o, i) => {
            const s = STATUS[o.status as keyof typeof STATUS] ?? STATUS.new;
            const Icon = s.icon;
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl border", s.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {o.table_id ? `Mesa ${tables[o.table_id] ?? "?"}` : o.type === "delivery" ? "Delivery" : "Balcão"}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border", s.color)}>
                      {s.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">#{o.id.slice(0, 8)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(o.created_at)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-extrabold text-base">{fmt(Number(o.total))}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
