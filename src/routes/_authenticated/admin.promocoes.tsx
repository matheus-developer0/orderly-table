import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tag, Percent, Gift, Plus, Calendar, TrendingUp, Sparkles, Loader2, X, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/promocoes")({
  component: PromocoesPage,
});

type PromoType = "percent" | "fixed" | "combo";
type Promo = {
  id: string;
  title: string;
  description: string | null;
  type: PromoType;
  value: number;
  scope: string | null;
  active: boolean;
};

const TYPE_META: Record<PromoType, { icon: React.ElementType; cls: string; label: string }> = {
  percent: { icon: Percent, cls: "bg-emerald-500/10 text-emerald-600", label: "Desconto %" },
  fixed:   { icon: Tag,     cls: "bg-amber-500/10 text-amber-600",   label: "Preço fixo" },
  combo:   { icon: Gift,    cls: "bg-purple-500/10 text-purple-600", label: "Combo" },
};

function PromocoesPage() {
  const { restaurant } = useAuth();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) return;
    setLoading(true);
    const { data } = await supabase
      .from("promotions")
      .select("id,title,description,type,value,scope,active")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false });
    setPromos((data ?? []) as Promo[]);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (p: Promo) => {
    const { error } = await supabase.from("promotions").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error("Erro");
    setPromos((list) => list.map((x) => x.id === p.id ? { ...x, active: !x.active } : x));
    toast.success(p.active ? "Promoção pausada" : "Promoção ativada");
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Excluir "${p.title}"?`)) return;
    const { error } = await supabase.from("promotions").delete().eq("id", p.id);
    if (error) return toast.error("Erro");
    setPromos((list) => list.filter((x) => x.id !== p.id));
    toast.success("Excluída");
  };

  const openNew = (type?: PromoType) => {
    setEditing({ id: "", title: "", description: "", type: type ?? "percent", value: 0, scope: "", active: true });
    setOpen(true);
  };

  const openEdit = (p: Promo) => { setEditing(p); setOpen(true); };

  return (
    <div className="space-y-8 p-6 lg:p-10">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Marketing</div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" /> Promoções
          </h1>
          <p className="text-sm text-muted-foreground">Aumente seu ticket médio com ofertas inteligentes</p>
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-brand hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova promoção
        </button>
      </header>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Templates rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(TYPE_META) as PromoType[]).map((k) => {
            const t = TYPE_META[k];
            const Icon = t.icon;
            return (
              <button key={k} onClick={() => openNew(k)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.cls}`}><Icon className="h-5 w-5" /></div>
                <div className="font-bold">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {k === "percent" ? "Aplica desconto percentual em categorias ou produtos" :
                   k === "combo"   ? "Agrupe produtos com preço promocional" :
                                     "Defina um preço fixo promocional (happy hour, terça especial)"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Suas promoções</h2>
        {loading ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : promos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma promoção criada ainda.</p>
            <button onClick={() => openNew()} className="mt-3 text-sm font-bold text-primary hover:underline">Criar a primeira</button>
          </div>
        ) : (
          <div className="space-y-2">
            {promos.map((p, i) => {
              const t = TYPE_META[p.type];
              const Icon = t.icon;
              const display = p.type === "percent" ? `${p.value}% OFF` : `R$ ${Number(p.value).toFixed(2).replace(".", ",")}`;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className={`grid h-12 w-12 place-items-center rounded-xl ${t.cls}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{p.title}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{display}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.scope || p.description || t.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${p.active ? "text-success" : "text-muted-foreground"}`}>
                      {p.active ? "Ativa" : "Pausada"}
                    </span>
                    <button onClick={() => void toggle(p)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${p.active ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => void remove(p)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">Dica de marketing</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Promoções por horário (happy hour, almoço executivo) costumam aumentar o ticket médio em até 18%.
            </p>
          </div>
        </div>
      </section>

      {open && editing && (
        <PromoDialog
          promo={editing}
          restaurantId={restaurant!.id}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

function PromoDialog({ promo, restaurantId, onClose, onSaved }: {
  promo: Promo; restaurantId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(promo);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Informe o título");
    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      title: form.title.trim(),
      description: form.description || null,
      type: form.type,
      value: Number(form.value) || 0,
      scope: form.scope || null,
      active: form.active,
    };
    const { error } = form.id
      ? await supabase.from("promotions").update(payload).eq("id", form.id)
      : await supabase.from("promotions").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar");
    toast.success(form.id ? "Atualizada" : "Promoção criada");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-elevated space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{form.id ? "Editar promoção" : "Nova promoção"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Título</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Happy Hour Chopp"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                <option value="percent">Desconto %</option>
                <option value="fixed">Preço fixo</option>
                <option value="combo">Combo</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {form.type === "percent" ? "% de desconto" : "Valor R$"}
              </label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Escopo / regras</label>
            <input value={form.scope ?? ""} onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="Ex: Bebidas · 17h às 19h"
              className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</label>
            <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="Detalhes que aparecem no cardápio"
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary" />
            Promoção ativa
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-brand hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
