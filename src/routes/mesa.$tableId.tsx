import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  Loader2,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  Search,
  X,
  CheckCircle2,
  Bell,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/mesa/$tableId")({
  component: MesaPage,
});

type Restaurant = { id: string; name: string; primary_color: string | null };
type Table = { id: string; number: number; restaurant_id: string };
type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  category_id: string | null;
};
type CartItem = { product: Product; quantity: number; notes: string };

function MesaPage() {
  const { tableId } = Route.useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data: t } = await supabase
      .from("tables")
      .select("id,number,restaurant_id")
      .eq("id", tableId)
      .maybeSingle();
    if (!t) { setNotFound(true); setLoading(false); return; }
    setTable(t);

    const [{ data: r }, { data: prods }, { data: cats }] = await Promise.all([
      supabase.from("restaurants").select("id,name,primary_color").eq("id", t.restaurant_id).maybeSingle(),
      supabase.from("products").select("id,name,description,price,promo_price,image_url,available,featured,category_id").eq("restaurant_id", t.restaurant_id).eq("available", true).order("name"),
      supabase.from("categories").select("id,name,sort_order").eq("restaurant_id", t.restaurant_id).order("sort_order"),
    ]);
    if (r) setRestaurant(r);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }, [tableId]);

  useEffect(() => { void load(); }, [load]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, notes: "" }];
    });
    toast.success(`${product.name} adicionado!`, { duration: 1500 });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev
      .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter((i) => i.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, i) => sum + (i.product.promo_price ?? i.product.price) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const sendOrder = async () => {
    if (!restaurant || !table || cart.length === 0) return;
    setSending(true);
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        table_id: table.id,
        status: "new",
        type: "dine_in",
        total: cartTotal,
      })
      .select("id")
      .maybeSingle();
    if (error || !order) {
      toast.error("Erro ao enviar pedido. Tente novamente.");
      setSending(false);
      return;
    }
    await supabase.from("order_items").insert(
      cart.map((i) => ({
        order_id: order.id,
        product_id: i.product.id,
        name_snapshot: i.product.name,
        price_snapshot: i.product.promo_price ?? i.product.price,
        quantity: i.quantity,
        notes: i.notes || null,
        addons: [],
      })),
    );
    setCart([]);
    setCartOpen(false);
    setOrderSent(true);
    setSending(false);
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.category_id === activeCategory;
    return matchSearch && matchCat;
  });

  const featured = filtered.filter((p) => p.featured);
  const brandColor = restaurant?.primary_color ?? "#E11D2E";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !restaurant || !table) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="text-2xl font-extrabold">Mesa não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Verifique o QR Code e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (orderSent) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm text-center space-y-5"
        >
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pedido enviado!</h1>
          <p className="text-sm text-muted-foreground">
            Sua mesa é a <strong>Mesa {table.number}</strong>. Aguarde — a cozinha já recebeu seu pedido.
          </p>
          <button
            onClick={() => setOrderSent(false)}
            className="h-12 w-full rounded-xl font-bold text-primary-foreground"
            style={{ background: brandColor }}
          >
            Fazer mais pedidos
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div
        className="px-5 pb-8 pt-10 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brandColor}, #1a1a1a)` }}
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70">
            <Utensils className="h-3.5 w-3.5" />
            Mesa {table.number}
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{restaurant.name}</h1>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void callWaiter()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-xs font-bold hover:bg-white/25 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" /> Chamar garçom
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá ${restaurant.name}, estou na mesa ${table.number}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-xs font-bold hover:bg-white/25 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${!activeCategory ? "text-white" : "border border-border text-muted-foreground"}`}
              style={!activeCategory ? { background: brandColor } : {}}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${activeCategory === cat.id ? "text-white" : "border border-border text-muted-foreground"}`}
                style={activeCategory === cat.id ? { background: brandColor } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Featured */}
        {!search && !activeCategory && featured.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">⭐ Destaques</h2>
            <div className="grid grid-cols-1 gap-3">
              {featured.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} cartQty={cart.find((i) => i.product.id === p.id)?.quantity ?? 0} brandColor={brandColor} />)}
            </div>
          </section>
        )}

        {/* All products */}
        <section>
          {(!search && !activeCategory && featured.length > 0) && (
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Cardápio completo</h2>
          )}
          {filtered.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} cartQty={cart.find((i) => i.product.id === p.id)?.quantity ?? 0} brandColor={brandColor} />)}
            </div>
          )}
        </section>
      </div>

      {/* Cart FAB */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-20"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-5 py-4 font-bold text-white shadow-xl transition-transform hover:scale-[1.01]"
              style={{ background: brandColor }}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart modal */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 z-30 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl bg-card p-5 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold">Seu pedido</h2>
                <button onClick={() => setCartOpen(false)} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ul className="space-y-3 mb-5">
                {cart.map((item) => (
                  <li key={item.product.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        R$ {((item.product.promo_price ?? item.product.price) * item.quantity).toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted">
                        {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, 1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-border pt-4 mb-4">
                <div className="flex justify-between font-extrabold">
                  <span>Total</span>
                  <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              <button
                onClick={() => void sendOrder()}
                disabled={sending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white transition-transform hover:scale-[1.01]"
                style={{ background: brandColor }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido para a cozinha"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  cartQty,
  brandColor,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  cartQty: number;
  brandColor: string;
}) {
  const price = product.promo_price ?? product.price;
  const hasPromo = !!product.promo_price;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="h-16 w-16 rounded-xl bg-muted shrink-0 grid place-items-center text-2xl">
          🍽️
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-snug">{product.name}</div>
        {product.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{product.description}</div>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-extrabold text-sm" style={{ color: brandColor }}>
            R$ {price.toFixed(2).replace(".", ",")}
          </span>
          {hasPromo && (
            <span className="text-xs text-muted-foreground line-through">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onAdd(product)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-transform hover:scale-[1.05]"
        style={{ background: brandColor }}
      >
        {cartQty > 0 ? (
          <span className="text-xs font-bold">{cartQty}</span>
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
