import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProdutosPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  available: boolean;
  featured: boolean;
  category_id: string | null;
  image_url: string | null;
};

type Category = { id: string; name: string };

const EMPTY: Omit<Product, "id"> = {
  name: "",
  description: "",
  price: 0,
  promo_price: null,
  available: true,
  featured: false,
  category_id: null,
  image_url: null,
};

function ProductModal({
  initial,
  categories,
  restaurantId,
  onClose,
  onSaved,
}: {
  initial: Partial<Product> | null;
  categories: Category[];
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial?.id;
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof EMPTY, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      price: Number(form.price),
      promo_price: form.promo_price ? Number(form.promo_price) : null,
      available: form.available,
      featured: form.featured,
      category_id: form.category_id || null,
      image_url: form.image_url || null,
    };
    const { error } = isNew
      ? await supabase.from("products").insert({ ...payload, restaurant_id: restaurantId })
      : await supabase.from("products").update(payload).eq("id", initial!.id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Produto criado!" : "Produto atualizado!");
    onSaved();
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-30 bg-black/50" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-4 z-40 overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">{isNew ? "Novo produto" : "Editar produto"}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Nome *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              className="input-base" placeholder="Ex: X-Burguer Especial" />
          </Field>
          <Field label="Descrição">
            <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)}
              rows={2} className="input-base resize-none" placeholder="Ingredientes, detalhes..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço (R$) *">
              <input type="number" min={0} step={0.01} value={form.price}
                onChange={(e) => set("price", e.target.value)} className="input-base" />
            </Field>
            <Field label="Preço promo (R$)">
              <input type="number" min={0} step={0.01} value={form.promo_price ?? ""}
                onChange={(e) => set("promo_price", e.target.value || null)} className="input-base" placeholder="Opcional" />
            </Field>
          </div>
          <Field label="URL da imagem">
            <input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)}
              className="input-base" placeholder="https://..." />
          </Field>
          {categories.length > 0 && (
            <Field label="Categoria">
              <select value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value || null)} className="input-base">
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <div className="flex gap-4">
            <Toggle label="Disponível" value={form.available} onChange={(v) => set("available", v)} />
            <Toggle label="Destaque" value={form.featured} onChange={(v) => set("featured", v)} />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void save()} disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex items-center gap-2 rounded-xl px-3 h-9 text-sm font-medium border transition-all ${value ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border text-muted-foreground hover:bg-muted"}`}>
      {value ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ProdutosPage() {
  const { restaurant } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; product: Partial<Product> | null }>({ open: false, product: null });

  const load = async () => {
    if (!restaurant) return;
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("id,name,description,price,promo_price,available,featured,category_id,image_url").eq("restaurant_id", restaurant.id).order("name"),
      supabase.from("categories").select("id,name").eq("restaurant_id", restaurant.id).order("sort_order"),
    ]);
    setItems(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [restaurant?.id]);

  const remove = async (id: string) => {
    if (!confirm("Remover produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast.success("Produto removido");
    void load();
  };

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cardápio</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} produto{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setModal({ open: true, product: null })}
          className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
          <Plus className="h-4 w-4" />Novo produto
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum produto ainda. Adicione o primeiro!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-32 rounded-xl object-cover" />}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal({ open: true, product: p })}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => void remove(p.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-extrabold text-primary">
                    R$ {(p.promo_price ?? p.price).toFixed(2).replace(".", ",")}
                  </span>
                  {p.promo_price && (
                    <span className="ml-2 text-xs text-muted-foreground line-through">
                      R$ {p.price.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {p.featured && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">Destaque</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.available ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {p.available ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal.open && restaurant && (
          <ProductModal
            initial={modal.product}
            categories={categories}
            restaurantId={restaurant.id}
            onClose={() => setModal({ open: false, product: null })}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
