import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Plus, Pencil, Trash2, X, Check,
  Pizza, Tag, Search, GripVertical, Image,
  Clock, Star, Eye, EyeOff, ChevronDown, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: CardapioPage,
});

/* ─── Types ─────────────────────────────────────────────────────────── */
type Category = {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  product_count?: number;
};

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
  prep_minutes: number | null;
};

/* ─── Shared UI ──────────────────────────────────────────────────────── */
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 h-9 text-sm font-medium border transition-all",
        value
          ? "gradient-brand text-primary-foreground border-transparent shadow-brand"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {value ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="fixed inset-4 z-40 flex flex-col overflow-hidden rounded-2xl bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
        <div className="border-t border-border px-6 py-4 flex gap-3">{footer}</div>
      </motion.div>
    </>
  );
}

/* ─── Category Modal ────────────────────────────────────────────────── */
function CategoryModal({
  initial, restaurantId, nextOrder, onClose, onSaved,
}: {
  initial: Category | null;
  restaurantId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial?.id;
  const [name, setName] = useState(initial?.name ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = { name: name.trim(), image_url: imageUrl || null };
    const { error } = isNew
      ? await supabase.from("categories").insert({ ...payload, restaurant_id: restaurantId, sort_order: nextOrder })
      : await supabase.from("categories").update(payload).eq("id", initial!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Categoria criada!" : "Categoria atualizada!");
    onSaved();
    onClose();
  };

  return (
    <Modal
      title={isNew ? "Nova categoria" : "Editar categoria"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar</>}
          </button>
        </>
      }
    >
      <Field label="Nome *">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void save()}
          className="input-base"
          placeholder="Ex: Entradas, Bebidas, Sobremesas..."
        />
      </Field>
      <Field label="URL da imagem" hint="Imagem exibida no cardápio digital (opcional)">
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="input-base"
          placeholder="https://..."
        />
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="mt-2 h-20 w-full rounded-xl object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
        )}
      </Field>
    </Modal>
  );
}

/* ─── Product Modal ─────────────────────────────────────────────────── */
const EMPTY_PRODUCT: Omit<Product, "id"> = {
  name: "", description: "", price: 0, promo_price: null,
  available: true, featured: false, category_id: null, image_url: null, prep_minutes: null,
};

function ProductModal({
  initial, categories, restaurantId, onClose, onSaved,
}: {
  initial: Partial<Product> | null;
  categories: Category[];
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial?.id;
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, ...initial });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof EMPTY_PRODUCT>(k: K, v: (typeof EMPTY_PRODUCT)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (Number(form.price) <= 0) return toast.error("Preço deve ser maior que zero");
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
      prep_minutes: form.prep_minutes ? Number(form.prep_minutes) : null,
    };
    const { error } = isNew
      ? await supabase.from("products").insert({ ...payload, restaurant_id: restaurantId, addons: [] })
      : await supabase.from("products").update(payload).eq("id", initial!.id!);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Produto criado!" : "Produto atualizado!");
    onSaved();
    onClose();
  };

  const hasPromo = !!form.promo_price;

  return (
    <Modal
      title={isNew ? "Novo produto" : "Editar produto"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar</>}
          </button>
        </>
      }
    >
      <Field label="Nome *">
        <input
          autoFocus
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          className="input-base"
          placeholder="Ex: X-Burguer Especial"
        />
      </Field>

      <Field label="Descrição">
        <textarea
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="input-base resize-none"
          placeholder="Ingredientes, detalhes..."
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço (R$) *">
          <input
            type="number" min={0} step={0.01}
            value={form.price}
            onChange={(e) => set("price", Number(e.target.value))}
            className="input-base"
          />
        </Field>
        <Field label="Preço promo (R$)">
          <input
            type="number" min={0} step={0.01}
            value={form.promo_price ?? ""}
            onChange={(e) => set("promo_price", e.target.value ? Number(e.target.value) : null)}
            className="input-base"
            placeholder="Opcional"
          />
        </Field>
      </div>

      {hasPromo && (
        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          Desconto de{" "}
          <strong>
            {Math.round((1 - Number(form.promo_price) / Number(form.price)) * 100)}%
          </strong>
          {" "}ativo
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select
            value={form.category_id ?? ""}
            onChange={(e) => set("category_id", e.target.value || null)}
            className="input-base"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Tempo de preparo" hint="minutos">
          <input
            type="number" min={0}
            value={form.prep_minutes ?? ""}
            onChange={(e) => set("prep_minutes", e.target.value ? Number(e.target.value) : null)}
            className="input-base"
            placeholder="Ex: 15"
          />
        </Field>
      </div>

      <Field label="URL da imagem">
        <input
          value={form.image_url ?? ""}
          onChange={(e) => set("image_url", e.target.value || null)}
          className="input-base"
          placeholder="https://..."
        />
        {form.image_url && (
          <img
            src={form.image_url}
            alt="preview"
            className="mt-2 h-28 w-full rounded-xl object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Toggle label="Disponível" value={form.available} onChange={(v) => set("available", v)} />
        <Toggle label="⭐ Destaque" value={form.featured} onChange={(v) => set("featured", v)} />
      </div>
    </Modal>
  );
}

/* ─── Category Row (draggable) ──────────────────────────────────────── */
function CategoryRow({
  cat, onEdit, onDelete,
}: {
  cat: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
      {cat.image_url ? (
        <img src={cat.image_url} alt={cat.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-accent/40 grid place-items-center shrink-0">
          <Tag className="h-4 w-4 text-accent-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{cat.name}</div>
        <div className="text-xs text-muted-foreground">
          {cat.product_count ?? 0} produto{(cat.product_count ?? 0) !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => onEdit(cat)}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(cat)}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Product Card ──────────────────────────────────────────────────── */
function ProductCard({
  p, catName, onEdit, onDelete, onToggleAvailable,
}: {
  p: Product;
  catName: string | null;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onToggleAvailable: (p: Product) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-2xl border bg-card shadow-card overflow-hidden flex flex-col",
        !p.available && "opacity-60",
      )}
    >
      {p.image_url ? (
        <div className="relative">
          <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover" />
          {p.featured && (
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
              <Star className="h-3 w-3 fill-yellow-400" />DESTAQUE
            </span>
          )}
          {!p.available && (
            <div className="absolute inset-0 bg-background/60 grid place-items-center">
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-bold text-muted-foreground">Inativo</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative h-20 bg-accent/20 grid place-items-center">
          <Image className="h-6 w-6 text-accent-foreground/30" />
          {p.featured && (
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
              <Star className="h-3 w-3" />DESTAQUE
            </span>
          )}
        </div>
      )}

      <div className="flex-1 p-4 space-y-2">
        <div>
          <div className="font-bold leading-snug">{p.name}</div>
          {catName && (
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Tag className="h-2.5 w-2.5" />{catName}
            </div>
          )}
          {p.description && (
            <div className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{p.description}</div>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-extrabold text-primary">
              R$ {(p.promo_price ?? p.price).toFixed(2).replace(".", ",")}
            </div>
            {p.promo_price && (
              <div className="text-xs text-muted-foreground line-through">
                R$ {p.price.toFixed(2).replace(".", ",")}
              </div>
            )}
          </div>
          {p.prep_minutes && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />{p.prep_minutes}min
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
        <button
          onClick={() => onToggleAvailable(p)}
          title={p.available ? "Desativar" : "Ativar"}
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          {p.available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {p.available ? "Ativo" : "Inativo"}
        </button>
        <button
          onClick={() => onEdit(p)}
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />Editar
        </button>
        <button
          onClick={() => onDelete(p)}
          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />Excluir
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
type Tab = "produtos" | "categorias";

function CardapioPage() {
  const { restaurant } = useAuth();
  const [tab, setTab] = useState<Tab>("produtos");

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterAvail, setFilterAvail] = useState<"all" | "active" | "inactive">("all");

  // Modals
  const [productModal, setProductModal] = useState<{ open: boolean; product: Partial<Product> | null }>({ open: false, product: null });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });

  const load = useCallback(async () => {
    if (!restaurant) return;
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,description,price,promo_price,available,featured,category_id,image_url,prep_minutes")
        .eq("restaurant_id", restaurant.id)
        .order("name"),
      supabase
        .from("categories")
        .select("id,name,image_url,sort_order")
        .eq("restaurant_id", restaurant.id)
        .order("sort_order"),
    ]);

    const productList = prods ?? [];
    const catList = (cats ?? []).map((c) => ({
      ...c,
      product_count: productList.filter((p) => p.category_id === c.id).length,
    }));

    setProducts(productList);
    setCategories(catList);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  // Product actions
  const deleteProduct = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    toast.success("Produto excluído");
    void load();
  };

  const toggleAvailable = async (p: Product) => {
    await supabase.from("products").update({ available: !p.available }).eq("id", p.id);
    setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, available: !x.available } : x));
    toast.success(p.available ? "Produto desativado" : "Produto ativado");
  };

  // Category actions
  const deleteCategory = async (c: Category) => {
    if ((c.product_count ?? 0) > 0) {
      toast.error(`Esta categoria tem ${c.product_count} produto(s). Remova-os primeiro.`);
      return;
    }
    if (!confirm(`Excluir categoria "${c.name}"?`)) return;
    await supabase.from("categories").delete().eq("id", c.id);
    toast.success("Categoria excluída");
    void load();
  };

  // Filtered products
  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || p.category_id === filterCat;
    const matchAvail = filterAvail === "all" || (filterAvail === "active" ? p.available : !p.available);
    return matchSearch && matchCat && matchAvail;
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const featuredCount = products.filter((p) => p.featured).length;
  const inactiveCount = products.filter((p) => !p.available).length;

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gestão</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Cardápio</h1>
          </div>
          <button
            onClick={() =>
              tab === "produtos"
                ? setProductModal({ open: true, product: null })
                : setCategoryModal({ open: true, category: null })
            }
            className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform shrink-0"
          >
            <Plus className="h-4 w-4" />
            {tab === "produtos" ? "Novo produto" : "Nova categoria"}
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total de produtos", value: products.length, icon: Pizza },
            { label: "Categorias", value: categories.length, icon: Tag },
            { label: "Em destaque", value: featuredCount, icon: Star },
            { label: "Inativos", value: inactiveCount, icon: EyeOff },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{label}:</span>
              <span className="text-xs font-bold">{value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
          {([
            { key: "produtos", label: "Produtos", icon: Pizza },
            { key: "categorias", label: "Categorias", icon: Tag },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                tab === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {tab === "produtos" ? (
            <motion.div key="produtos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produto..."
                    className="input-base pl-9"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {categories.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterCat ?? ""}
                      onChange={(e) => setFilterCat(e.target.value || null)}
                      className="input-base w-auto pr-8 appearance-none cursor-pointer"
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                <div className="relative">
                  <select
                    value={filterAvail}
                    onChange={(e) => setFilterAvail(e.target.value as typeof filterAvail)}
                    className="input-base w-auto pr-8 appearance-none cursor-pointer"
                  >
                    <option value="all">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Result count */}
              {(search || filterCat || filterAvail !== "all") && (
                <div className="text-sm text-muted-foreground">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                  {" "}<button onClick={() => { setSearch(""); setFilterCat(null); setFilterAvail("all"); }} className="text-primary hover:underline ml-1">Limpar filtros</button>
                </div>
              )}

              {/* Grid */}
              {filtered.length === 0 ? (
                <div className="grid place-items-center py-20 text-center">
                  <div className="rounded-2xl border border-dashed border-border p-12 max-w-sm mx-auto space-y-3">
                    <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {products.length === 0
                        ? "Nenhum produto cadastrado. Comece adicionando o primeiro!"
                        : "Nenhum produto encontrado com esses filtros."}
                    </p>
                    {products.length === 0 && (
                      <button
                        onClick={() => setProductModal({ open: true, product: null })}
                        className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand"
                      >
                        Adicionar produto
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((p) => (
                      <ProductCard
                        key={p.id}
                        p={p}
                        catName={p.category_id ? catMap[p.category_id] ?? null : null}
                        onEdit={(p) => setProductModal({ open: true, product: p })}
                        onDelete={deleteProduct}
                        onToggleAvailable={toggleAvailable}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="categorias" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 max-w-2xl">
              {categories.length === 0 ? (
                <div className="grid place-items-center py-20 text-center">
                  <div className="rounded-2xl border border-dashed border-border p-12 max-w-sm mx-auto space-y-3">
                    <Tag className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma categoria ainda. Crie categorias para organizar seu cardápio.
                    </p>
                    <button
                      onClick={() => setCategoryModal({ open: true, category: null })}
                      className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand"
                    >
                      Criar categoria
                    </button>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {categories.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      onEdit={(c) => setCategoryModal({ open: true, category: c })}
                      onDelete={deleteCategory}
                    />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {productModal.open && restaurant && (
          <ProductModal
            initial={productModal.product}
            categories={categories}
            restaurantId={restaurant.id}
            onClose={() => setProductModal({ open: false, product: null })}
            onSaved={load}
          />
        )}
        {categoryModal.open && restaurant && (
          <CategoryModal
            initial={categoryModal.category}
            restaurantId={restaurant.id}
            nextOrder={categories.length}
            onClose={() => setCategoryModal({ open: false, category: null })}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
