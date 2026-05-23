import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Plus, Download, Loader2, Trash2, QrCode,
  Utensils, CheckCircle2, AlertTriangle, RefreshCw,
  Printer, X, Check, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/mesas")({
  component: MesasPage,
});

type TableStatus = "free" | "occupied" | "bill_requested";

type Table = {
  id: string;
  number: number;
  qr_code: string;
  status: TableStatus;
  order_total?: number;
  order_count?: number;
  occupied_since?: string | null;
};

const STATUS_META: Record<TableStatus, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: "Livre", color: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  occupied: { label: "Ocupada", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: <Utensils className="h-3.5 w-3.5" /> },
  bill_requested: { label: "Conta pedida", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  return `${Math.floor(s / 3600)}h`;
}

function EditTableModal({ table, onClose, onSaved }: {
  table: Table; onClose: () => void; onSaved: () => void;
}) {
  const [number, setNumber] = useState(String(table.number));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = parseInt(number);
    if (isNaN(n) || n < 1) return toast.error("Número inválido");
    setSaving(true);
    const { error } = await supabase.from("tables").update({ number: n }).eq("id", table.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mesa atualizada");
    onSaved();
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">Editar Mesa</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número da mesa</label>
          <input
            type="number" min={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            className="input-base"
            autoFocus
          />
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function QRModal({ table, qrUrl, onClose }: { table: Table; qrUrl: string; onClose: () => void }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `mesa-${table.number}.png`;
    a.click();
  };

  const print = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Mesa ${table.number}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff}
      img{width:280px;height:280px}h2{margin:16px 0 4px;font-size:24px}p{color:#666;margin:0;font-size:14px}</style>
      </head><body>
      <img src="${qrUrl}" />
      <h2>Mesa ${table.number}</h2>
      <p>Escaneie para ver o cardápio</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl text-center">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">QR Code — Mesa {table.number}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="rounded-2xl bg-white p-4 mx-auto w-fit">
          <img src={qrUrl} alt={`QR Mesa ${table.number}`} className="h-56 w-56" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Aponte a câmera do celular para acessar o cardápio</p>
        <div className="mt-5 flex gap-3">
          <button onClick={print}
            className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted">
            <Printer className="h-4 w-4" />Imprimir
          </button>
          <button onClick={download}
            className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand">
            <Download className="h-4 w-4" />Baixar
          </button>
        </div>
      </motion.div>
    </>
  );
}

function MesasPage() {
  const { restaurant } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [editModal, setEditModal] = useState<Table | null>(null);
  const [qrModal, setQrModal] = useState<Table | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | TableStatus>("all");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("tables")
      .select("id,number,qr_code,status")
      .eq("restaurant_id", restaurant.id)
      .order("number");
    const list = data ?? [];

    // Get active order info per table
    const occupiedIds = list.filter((t) => t.status !== "free").map((t) => t.id);
    let orderMap: Record<string, { total: number; count: number; since: string }> = {};
    if (occupiedIds.length > 0) {
      const { data: orders } = await supabase
        .from("orders")
        .select("table_id,total,created_at")
        .in("table_id", occupiedIds)
        .in("status", ["new", "preparing", "ready"])
        .order("created_at");
      for (const o of orders ?? []) {
        if (!o.table_id) continue;
        if (!orderMap[o.table_id]) orderMap[o.table_id] = { total: 0, count: 0, since: o.created_at };
        orderMap[o.table_id].total += Number(o.total);
        orderMap[o.table_id].count += 1;
      }
    }

    const enriched: Table[] = list.map((t) => ({
      ...t,
      status: t.status as TableStatus,
      order_total: orderMap[t.id]?.total,
      order_count: orderMap[t.id]?.count,
      occupied_since: orderMap[t.id]?.since ?? null,
    }));
    setTables(enriched);
    setLoading(false);

    // Generate QRs lazily
    void generateQRs(list);
  }, [restaurant]);

  const generateQRs = async (list: { id: string; number: number }[]) => {
    const missing = list.filter((t) => !qrs[t.id]);
    if (missing.length === 0) return;
    const entries = await Promise.all(
      missing.map(async (t) => {
        const url = `${window.location.origin}/mesa/${t.id}`;
        const png = await QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: "#1a1a1a", light: "#ffffff" } });
        return [t.id, png] as [string, string];
      }),
    );
    setQrs((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase
      .channel(`tables-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurant.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, load]);

  const addTables = async () => {
    if (!restaurant) return;
    setAdding(true);
    const lastNumber = tables.at(-1)?.number ?? 0;
    const rows = Array.from({ length: addCount }, (_, i) => ({
      restaurant_id: restaurant.id,
      number: lastNumber + i + 1,
      qr_code: `${restaurant.slug}-mesa-${lastNumber + i + 1}`,
    }));
    const { error } = await supabase.from("tables").insert(rows);
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success(`${addCount} mesa${addCount > 1 ? "s" : ""} criada${addCount > 1 ? "s" : ""}!`);
    void load();
  };

  const deleteTable = async (t: Table) => {
    if (t.status !== "free") return toast.error("Só é possível excluir mesas livres");
    if (!confirm(`Excluir Mesa ${t.number}?`)) return;
    await supabase.from("tables").delete().eq("id", t.id);
    toast.success(`Mesa ${t.number} excluída`);
    void load();
  };

  const resetTable = async (t: Table) => {
    await supabase.from("tables").update({ status: "free" }).eq("id", t.id);
    toast.success(`Mesa ${t.number} liberada`);
    void load();
  };

  const filtered = filterStatus === "all" ? tables : tables.filter((t) => t.status === filterStatus);

  const counts = {
    all: tables.length,
    free: tables.filter((t) => t.status === "free").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    bill_requested: tables.filter((t) => t.status === "bill_requested").length,
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Mesas & QR Codes</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background overflow-hidden">
              <select
                value={addCount}
                onChange={(e) => setAddCount(Number(e.target.value))}
                className="h-10 bg-transparent px-3 text-sm font-medium outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n} mesa{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <button
              onClick={() => void addTables()}
              disabled={adding}
              className="flex h-10 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3 flex-wrap">
          {([
            ["all", "Todas"],
            ["free", "Livres"],
            ["occupied", "Ocupadas"],
            ["bill_requested", "Conta pedida"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all",
                filterStatus === key
                  ? "gradient-brand text-primary-foreground border-transparent shadow-brand"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", filterStatus === key ? "bg-white/20" : "bg-muted")}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(8)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {tables.length === 0 ? "Nenhuma mesa criada ainda." : "Nenhuma mesa com este status."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((t, i) => {
                const meta = STATUS_META[t.status];
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "rounded-2xl border bg-card shadow-card flex flex-col overflow-hidden",
                      t.status === "bill_requested" && "border-amber-500/30 ring-1 ring-amber-500/20",
                      t.status === "occupied" && "border-blue-500/20",
                    )}
                  >
                    {/* Card header */}
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mesa</div>
                          <div className="text-3xl font-black tracking-tight">{t.number}</div>
                        </div>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", meta.color)}>
                          {meta.icon}{meta.label}
                        </span>
                      </div>

                      {t.status !== "free" && (
                        <div className="mt-2 space-y-0.5">
                          {t.order_total ? (
                            <div className="text-sm font-extrabold text-primary">{fmt(t.order_total)}</div>
                          ) : null}
                          {t.occupied_since && (
                            <div className="text-[11px] text-muted-foreground">{timeAgo(t.occupied_since)} na mesa</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* QR */}
                    <div
                      className="mx-4 mb-3 cursor-pointer grid place-items-center rounded-xl bg-white p-2 border border-border/50"
                      onClick={() => qrs[t.id] && setQrModal(t)}
                    >
                      {qrs[t.id] ? (
                        <img src={qrs[t.id]} alt={`QR Mesa ${t.number}`} className="h-28 w-28" />
                      ) : (
                        <div className="h-28 w-28 grid place-items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-auto grid grid-cols-3 border-t border-border divide-x divide-border">
                      <button
                        onClick={() => setEditModal(t)}
                        className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />Editar
                      </button>
                      {t.status !== "free" ? (
                        <button
                          onClick={() => void resetTable(t)}
                          className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-success/10 hover:text-success transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />Liberar
                        </button>
                      ) : (
                        <button
                          onClick={() => qrs[t.id] && setQrModal(t)}
                          className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <QrCode className="h-3.5 w-3.5" />Ver QR
                        </button>
                      )}
                      <button
                        onClick={() => void deleteTable(t)}
                        className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title={t.status !== "free" ? "Só é possível excluir mesas livres" : "Excluir mesa"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />Excluir
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editModal && (
          <EditTableModal table={editModal} onClose={() => setEditModal(null)} onSaved={load} />
        )}
        {qrModal && qrs[qrModal.id] && (
          <QRModal table={qrModal} qrUrl={qrs[qrModal.id]} onClose={() => setQrModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
