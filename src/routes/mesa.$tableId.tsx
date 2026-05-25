import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils, Loader2, ShoppingCart, Plus, Minus, Trash2,
  ChevronRight, Search, X, CheckCircle2, Bell, Receipt,
  Clock, Star, User, Phone, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/mesa/$tableId")({ component: MesaPage });

type Restaurant = { id: string; name: string; primary_color: string | null; logo_url: string | null };
type Table     = { id: string; number: number; restaurant_id: string };
type Category  = { id: string; name: string; sort_order: number };
type Product   = { id: string; name: string; description: string | null; price: number; promo_price: number | null; image_url: string | null; available: boolean; featured: boolean; category_id: string | null; prep_minutes: number | null };
type CartItem  = { product: Product; quantity: number; notes: string };
type Screen    = "identify" | "menu" | "tracking";

const STATUS_INFO: Record<string, { label: string; desc: string; emoji: string; step: number }> = {
  new:              { label: "Pedido recebido!",   desc: "A cozinha já recebeu e vai preparar em breve.",  emoji: "🎉", step: 0 },
  preparing:        { label: "Em preparo",          desc: "Mãos na massa! Seu pedido está sendo feito.",    emoji: "👨‍🍳", step: 1 },
  ready:            { label: "Pronto!",             desc: "O garçom vai trazer agora mesmo.",              emoji: "✅", step: 2 },
  out_for_delivery: { label: "A caminho",           desc: "Seu pedido saiu para entrega.",                 emoji: "🛵", step: 2 },
  delivered:        { label: "Entregue!",           desc: "Bom apetite! 😋",                              emoji: "🎊", step: 3 },
  cancelled:        { label: "Cancelado",           desc: "Fale com o garçom para mais informações.",      emoji: "❌", step: -1 },
};
const STEPS = ["Recebido", "Preparando", "Pronto", "Entregue"];

function MesaPage() {
  const { tableId } = Route.useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [table,      setTable]      = useState<Table | null>(null);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);

  // Ident
  const [screen,        setScreen]        = useState<Screen>("identify");
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Menu
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [search,       setSearch]       = useState("");
  const [activeCategory, setActiveCat] = useState<string | null>(null);
  const [cartOpen,     setCartOpen]     = useState(false);
  const [noteTarget,   setNoteTarget]   = useState<string | null>(null);
  const [noteText,     setNoteText]     = useState("");
  const [sending,      setSending]      = useState(false);

  // Tracking
  const [lastOrderId,  setLastOrderId]  = useState<string | null>(null);
  const [orderStatus,  setOrderStatus]  = useState<string>("new");

  const load = useCallback(async () => {
    const { data: t } = await supabase.from("tables").select("id,number,restaurant_id").eq("id", tableId).maybeSingle();
    if (!t) { setNotFound(true); setLoading(false); return; }
    setTable(t);
    const [{ data: r }, { data: prods }, { data: cats }] = await Promise.all([
      supabase.from("restaurants").select("id,name,primary_color,logo_url").eq("id", t.restaurant_id).maybeSingle(),
      supabase.from("products").select("id,name,description,price,promo_price,image_url,available,featured,category_id,prep_minutes").eq("restaurant_id", t.restaurant_id).eq("available", true).order("name"),
      supabase.from("categories").select("id,name,sort_order").eq("restaurant_id", t.restaurant_id).order("sort_order"),
    ]);
    if (r) setRestaurant(r);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }, [tableId]);

  useEffect(() => { void load(); }, [load]);

  // Order realtime tracking
  useEffect(() => {
    if (!lastOrderId) return;
    const ch = supabase.channel(`order-track-${lastOrderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${lastOrderId}` },
        (p) => { setOrderStatus((p.new as { status: string }).status); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [lastOrderId]);

  const brandColor = restaurant?.primary_color ?? "#E11D2E";
  const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  const cartTotal = cart.reduce((s, i) => s + (i.product.promo_price ?? i.product.price) * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1, notes: "" }];
    });
    toast.success(`${p.name} adicionado!`, { duration: 1200 });
  };

  const updateQty = (id: string, d: number) =>
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: i.quantity + d } : i).filter(i => i.quantity > 0));

  const setNote = (id: string, n: string) =>
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, notes: n } : i));

  const callWaiter = async (reason: string) => {
    if (!restaurant || !table) return;
    await supabase.from("waiter_calls").insert({ restaurant_id: restaurant.id, table_id: table.id, reason });
    toast.success("Garçom chamado!", { description: "Ele vem até você em breve." });
  };

  const sendOrder = async () => {
    if (!restaurant || !table || !cart.length) return;
    setSending(true);
    const { data: order, error } = await supabase.from("orders")
      .insert({ restaurant_id: restaurant.id, table_id: table.id, status: "new", type: "dine_in", total: cartTotal })
      .select("id").maybeSingle();
    if (error || !order) { toast.error("Erro ao enviar pedido."); setSending(false); return; }

    const { data: sub } = await supabase.from("suborders")
      .insert({ order_id: order.id, customer_name: customerName.trim(), customer_phone: customerPhone.trim() || null, total: cartTotal })
      .select("id").maybeSingle();

    await supabase.from("order_items").insert(cart.map(i => ({
      order_id: order.id, suborder_id: sub?.id ?? null,
      product_id: i.product.id, name_snapshot: i.product.name,
      price_snapshot: i.product.promo_price ?? i.product.price,
      quantity: i.quantity, notes: i.notes || null, addons: [],
    })));

    setLastOrderId(order.id);
    setOrderStatus("new");
    setCart([]); setCartOpen(false);
    setScreen("tracking");
    setSending(false);
  };

  const filtered = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description ?? "").toLowerCase().includes(search.toLowerCase());
    const mc = !activeCategory || p.category_id === activeCategory;
    return ms && mc;
  });
  const featured = products.filter(p => p.featured);

  /* Loading / Not found */
  if (loading) return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: brandColor }} />
    </div>
  );
  if (notFound || !restaurant || !table) return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div><h1 className="text-2xl font-extrabold">Mesa não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">Verifique o QR Code e tente novamente.</p></div>
    </div>
  );

  /* ── IDENTIFY ── */
  if (screen === "identify") return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pb-12 pt-14 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #111 100%)` }}>
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative text-center space-y-3">
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-xl border-2 border-white/20" />
            : <div className="h-20 w-20 rounded-2xl bg-white/20 mx-auto grid place-items-center"><Utensils className="h-8 w-8 text-white" /></div>}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">Mesa {table.number}</div>
            <h1 className="text-3xl font-black tracking-tight mt-0.5">{restaurant.name}</h1>
            <p className="text-sm text-white/70 mt-1">Bem-vindo! Se identifique para pedir.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-8 space-y-5 max-w-sm mx-auto w-full">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seu nome *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input autoFocus value={customerName} onChange={e => setCustomerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && customerName.trim() && setScreen("menu")}
              className="input-base pl-9" placeholder="Como você se chama?" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Telefone <span className="text-muted-foreground/50 normal-case font-normal">(opcional)</span></label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              className="input-base pl-9" placeholder="(11) 99999-9999" />
          </div>
        </div>
        <button onClick={() => customerName.trim() && setScreen("menu")} disabled={!customerName.trim()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-extrabold text-white shadow-xl disabled:opacity-40 transition-transform active:scale-95"
          style={{ background: brandColor }}>
          Ver cardápio <ChevronRight className="h-5 w-5" />
        </button>
        <p className="text-center text-xs text-muted-foreground">Seus dados são usados apenas para organizar o pedido</p>
      </div>
    </div>
  );

  /* ── TRACKING ── */
  if (screen === "tracking") {
    const info = STATUS_INFO[orderStatus] ?? STATUS_INFO.new;
    const stepIdx = info.step;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="px-5 pb-10 pt-12 text-white text-center relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #111 100%)` }}>
          <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <motion.div key={info.emoji} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl mb-3">{info.emoji}</motion.div>
            <h1 className="text-2xl font-extrabold">{info.label}</h1>
            <p className="text-sm text-white/70 mt-1">{info.desc}</p>
            <p className="text-xs text-white/50 mt-2">Mesa {table.number} · {customerName}</p>
          </div>
        </div>

        <div className="flex-1 px-5 py-6 space-y-5 max-w-sm mx-auto w-full">
          {/* Progress steps */}
          {orderStatus !== "cancelled" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center">
                {STEPS.map((label, i) => {
                  const done = i <= stepIdx;
                  const active = i === stepIdx;
                  return (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-extrabold transition-all"
                          style={done ? { background: brandColor, color: "#fff" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>
                          {done && !active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                        </div>
                        <div className={`text-[10px] mt-1 font-medium text-center w-14 ${active ? "text-foreground font-bold" : "text-muted-foreground"}`}>{label}</div>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="flex-1 h-0.5 mb-4 mx-1 rounded-full" style={{ background: i < stepIdx ? brandColor : "var(--border)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ações rápidas</h2>
            {[
              { label: "Chamar garçom", desc: "Precisa de algo?", icon: Bell, reason: "Preciso de ajuda", color: "text-amber-500" },
              { label: "Pedir conta", desc: "Pronto para pagar", icon: Receipt, reason: "Pedir conta", color: "text-green-500" },
            ].map(action => {
              const Icon = action.icon;
              return (
                <button key={action.label} onClick={() => void callWaiter(action.reason)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted transition-colors text-left">
                  <div className={`grid h-9 w-9 place-items-center rounded-xl bg-muted ${action.color}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setScreen("menu")}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-2xl font-bold text-white"
              style={{ background: brandColor }}>
              <Plus className="h-4 w-4" />Mais itens
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── MENU ── */
  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="px-5 pb-6 pt-8 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, #111 100%)` }}>
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/60">
              <Utensils className="h-3.5 w-3.5" />Mesa {table.number}
            </div>
            <h1 className="text-2xl font-black tracking-tight mt-0.5">{restaurant.name}</h1>
            <div className="text-sm text-white/70 mt-0.5">{customerName}</div>
          </div>
          {lastOrderId && (
            <button onClick={() => setScreen("tracking")}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
              <Clock className="h-3.5 w-3.5" />Meu pedido
            </button>
          )}
        </div>
      </div>

      {/* Waiter strip */}
      <div className="flex gap-2 px-4 py-3 border-b border-border bg-card">
        {[
          { label: "Chamar garçom", icon: Bell, reason: "Preciso de ajuda", cls: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
          { label: "Pedir conta", icon: Receipt, reason: "Pedir conta", cls: "text-green-600 bg-green-500/10 border-green-500/30" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} onClick={() => void callWaiter(a.reason)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold ${a.cls}`}>
              <Icon className="h-4 w-4" />{a.label}
            </button>
          );
        })}
      </div>

      {/* Sticky search + categories */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar no cardápio..."
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-sm outline-none focus:border-primary" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {[{ id: null, name: "Todos" }, ...categories].map(cat => (
              <button key={cat.id ?? "all"} onClick={() => setActiveCat(cat.id ?? null)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={activeCategory === (cat.id ?? null) ? { background: brandColor, color: "#fff" } : {}}>
                <span className={activeCategory !== (cat.id ?? null) ? "text-muted-foreground" : ""}>{cat.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-6">
        {/* Featured */}
        {!search && !activeCategory && featured.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />Destaques
            </h2>
            <div className="space-y-3">
              {featured.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} qty={cart.find(i => i.product.id === p.id)?.quantity ?? 0} brandColor={brandColor} />)}
            </div>
          </section>
        )}

        {/* Full menu */}
        <section>
          {(!search && !activeCategory && featured.length > 0) && (
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Cardápio completo</h2>
          )}
          {filtered.length === 0
            ? <div className="grid place-items-center py-16"><p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p></div>
            : <div className="space-y-3">{filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} qty={cart.find(i => i.product.id === p.id)?.quantity ?? 0} brandColor={brandColor} />)}</div>
          }
        </section>
      </div>

      {/* FAB */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-6 left-4 right-4 z-20">
            <button onClick={() => setCartOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl px-5 py-4 font-bold text-white shadow-xl transition-transform active:scale-95"
              style={{ background: brandColor }}>
              <span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
              <span className="flex items-center gap-1">{fmt(cartTotal)}<ChevronRight className="h-4 w-4" /></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} className="fixed inset-0 z-30 bg-black/50" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl bg-card shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-extrabold">Seu pedido</h2>
                <button onClick={() => setCartOpen(false)} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="space-y-2 pb-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground">{fmt((item.product.promo_price ?? item.product.price) * item.quantity)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateQty(item.product.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted">
                          {item.quantity === 1 ? <Trash2 className="h-3 w-3 text-destructive" /> : <Minus className="h-3 w-3" />}
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product.id, 1)} className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                    {noteTarget === item.product.id ? (
                      <div className="flex gap-2">
                        <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setNote(item.product.id, noteText); setNoteTarget(null); } }}
                          placeholder="Ex: sem cebola..." className="input-base flex-1 text-xs h-8" />
                        <button onClick={() => { setNote(item.product.id, noteText); setNoteTarget(null); }}
                          className="h-8 px-3 rounded-lg gradient-brand text-xs text-primary-foreground font-bold">OK</button>
                      </div>
                    ) : (
                      <button onClick={() => { setNoteTarget(item.product.id); setNoteText(item.notes); }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {item.notes ? `📝 ${item.notes}` : "＋ Observação"}
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between font-extrabold pt-2 border-t border-border">
                  <span>Total</span><span>{fmt(cartTotal)}</span>
                </div>
                <button onClick={() => void sendOrder()} disabled={sending}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-extrabold text-white transition-transform active:scale-95"
                  style={{ background: brandColor }}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido 🚀"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onAdd, qty, brandColor }: { product: Product; onAdd: (p: Product) => void; qty: number; brandColor: string }) {
  const price = product.promo_price ?? product.price;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      {product.image_url
        ? <img src={product.image_url} alt={product.name} className="h-16 w-16 rounded-xl object-cover shrink-0" />
        : <div className="h-16 w-16 rounded-xl bg-muted shrink-0 grid place-items-center text-xl">🍽️</div>}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-snug">{product.name}</div>
        {product.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{product.description}</div>}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-sm" style={{ color: brandColor }}>{`R$ ${price.toFixed(2).replace(".", ",")}`}</span>
          {product.promo_price && <span className="text-xs text-muted-foreground line-through">{`R$ ${product.price.toFixed(2).replace(".", ",")}`}</span>}
          {product.prep_minutes && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{product.prep_minutes}min</span>}
        </div>
      </div>
      <button onClick={() => onAdd(product)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-transform active:scale-95" style={{ background: brandColor }}>
        {qty > 0 ? <span className="text-xs font-bold">{qty}</span> : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );
}

