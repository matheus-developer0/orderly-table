import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Plus, Loader2, X, Check, Pencil, Trash2, Tag, Calendar, Percent, DollarSign } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/promocoes")({ component: PromocoesPage });

type Promo = { id: string; title: string; description: string | null; type: string; value: number; active: boolean; starts_at: string | null; ends_at: string | null; scope: string | null; created_at: string };

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  percentage: { label: "Desconto %", icon: <Percent className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  fixed:      { label: "Valor fixo",  icon: <DollarSign className="h-4 w-4" />, color: "bg-green-500/10 text-green-600 border-green-500/20" },
  free_item:  { label: "Item grátis", icon: <Tag className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const isActive = (p: Promo) => {
  if (!p.active) return false;
  const now = Date.now();
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
  return true;
};

const EMPTY = { title: "", description: "", type: "percentage", value: 10, active: true, starts_at: "", ends_at: "", scope: "" };

function PromoModal({ initial, restaurantId, onClose, onSaved }: {
  initial: Promo | null; restaurantId: string; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !initial?.id;
  const [form, setForm] = useState({ ...EMPTY, ...(initial ? { ...initial, starts_at: initial.starts_at?.slice(0, 10) ?? "", ends_at: initial.ends_at?.slice(0, 10) ?? "", scope: initial.scope ?? "" } : {}) });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    if (Number(form.value) <= 0) return toast.error("Valor deve ser maior que zero");
    setSaving(true);
    const payload = {
      title: form.title.trim(), description: form.description || null,
      type: form.type, value: Number(form.value), active: form.active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      scope: form.scope || null,
    };
    const { error } = isNew
      ? await supabase.from("promotions").insert({ ...payload, restaurant_id: restaurantId })
      : await supabase.from("promotions").update(payload).eq("id", initial!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Promoção criada!" : "Promoção atualizada!");
    onSaved(); onClose();
  };

  return (<>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" />
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className="fixed inset-4 z-40 flex flex-col overflow-hidden rounded-2xl bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <h2 className="text-lg font-extrabold">{isNew ? "Nova promoção" : "Editar promoção"}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título *</label>
          <input autoFocus value={form.title} onChange={e => set("title", e.target.value)} className="input-base" placeholder="Ex: Happy Hour, Desconto de aniversário..." />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
          <textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={2} className="input-base resize-none" placeholder="Detalhes da promoção..." />
        </div>
        {/* Type */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de desconto</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <button key={k} onClick={() => set("type", k)}
                className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all",
                  form.type === k ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border hover:bg-muted")}>
                {v.icon}{v.label}
              </button>
            ))}
          </div>
        </div>
        {/* Value */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {form.type === "percentage" ? "Desconto (%)" : form.type === "fixed" ? "Valor do desconto (R$)" : "Qtd. itens grátis"}
          </label>
          <input type="number" min={0} step={form.type === "percentage" ? 1 : 0.01} value={form.value} onChange={e => set("value", Number(e.target.value))} className="input-base" />
          {form.type === "percentage" && Number(form.value) > 0 && Number(form.value) <= 100 && (
            <p className="text-xs text-muted-foreground">{form.value}% de desconto</p>
          )}
        </div>
        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Início</label>
            <input type="date" value={form.starts_at} onChange={e => set("starts_at", e.target.value)} className="input-base" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Término</label>
            <input type="date" value={form.ends_at} onChange={e => set("ends_at", e.target.value)} className="input-base" />
          </div>
        </div>
        {/* Scope */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aplicação</label>
          <input value={form.scope} onChange={e => set("scope", e.target.value)} className="input-base" placeholder='Ex: "categoria:bebidas", "produto:pizza", "todos"' />
        </div>
        {/* Active */}
        <button type="button" onClick={() => set("active", !form.active)}
          className={cn("flex items-center gap-2 rounded-xl px-3 h-9 text-sm font-medium border transition-all w-full",
            form.active ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border text-muted-foreground hover:bg-muted")}>
          {form.active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {form.active ? "Promoção ativa" : "Promoção inativa"}
        </button>
      </div>
      <div className="border-t border-border px-6 py-4 flex gap-3 shrink-0">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={() => void save()} disabled={saving}
          className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar</>}
        </button>
      </div>
    </motion.div>
  </>);
}

function PromocoesPage() {
  const { restaurant } = useAuth();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; promo: Promo | null }>({ open: false, promo: null });
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase.from("promotions")
      .select("id,title,description,type,value,active,starts_at,ends_at,scope,created_at")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    setPromos(data ?? []);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const deletePromo = async (p: Promo) => {
    if (!confirm(`Excluir "${p.title}"?`)) return;
    await supabase.from("promotions").delete().eq("id", p.id);
    toast.success("Promoção excluída");
    void load();
  };

  const toggleActive = async (p: Promo) => {
    await supabase.from("promotions").update({ active: !p.active }).eq("id", p.id);
    setPromos(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    toast.success(p.active ? "Promoção desativada" : "Promoção ativada!");
  };

  const filtered = promos.filter(p => {
    if (filter === "active") return isActive(p);
    if (filter === "inactive") return !isActive(p);
    return true;
  });

  const activeCount = promos.filter(isActive).length;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Marketing</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Promoções</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{activeCount} ativa{activeCount !== 1 ? "s" : ""} de {promos.length}</p>
          </div>
          <button onClick={() => setModal({ open: true, promo: null })}
            className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
            <Plus className="h-4 w-4" />Nova promoção
          </button>
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("rounded-xl border px-3 h-8 text-xs font-semibold transition-all",
                filter === f ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border text-muted-foreground hover:bg-muted")}>
              {f === "all" ? `Todas (${promos.length})` : f === "active" ? `Ativas (${activeCount})` : `Inativas (${promos.length - activeCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-3">{promos.length === 0 ? "Nenhuma promoção criada." : "Nenhuma promoção com este filtro."}</p>
            {promos.length === 0 && <button onClick={() => setModal({ open: true, promo: null })} className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand">Criar primeira promoção</button>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(p => {
                const active = isActive(p);
                const typeMeta = TYPE_META[p.type] ?? TYPE_META.percentage;
                return (
                  <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className={cn("rounded-2xl border bg-card shadow-card flex flex-col overflow-hidden", !active && "opacity-60")}>
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold", typeMeta.color)}>
                          {typeMeta.icon}{typeMeta.label}
                        </div>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                          {active ? "ATIVA" : "INATIVA"}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-base">{p.title}</div>
                        {p.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>}
                      </div>
                      <div className="text-3xl font-black text-primary">
                        {p.type === "percentage" ? `${p.value}%` : p.type === "fixed" ? fmt(p.value) : `${p.value}× grátis`}
                      </div>
                      {(p.starts_at || p.ends_at) && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {fmtDate(p.starts_at)} → {fmtDate(p.ends_at)}
                        </div>
                      )}
                      {p.scope && <div className="rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground font-mono">{p.scope}</div>}
                    </div>
                    <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
                      <button onClick={() => void toggleActive(p)}
                        className="flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors">
                        {active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{active ? "Desativar" : "Ativar"}
                      </button>
                      <button onClick={() => setModal({ open: true, promo: p })}
                        className="flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5" />Editar
                      </button>
                      <button onClick={() => void deletePromo(p)}
                        className="flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
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
        {modal.open && restaurant && (
          <PromoModal initial={modal.promo} restaurantId={restaurant.id} onClose={() => setModal({ open: false, promo: null })} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
