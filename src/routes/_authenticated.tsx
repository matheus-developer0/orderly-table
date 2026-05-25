import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, Pizza, QrCode, Users, LogOut, Loader2,
  ChefHat, HandPlatter, Bell, Menu, X,
  Receipt, Wallet, BarChart3, Bike, Sparkles, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({ component: AuthenticatedLayout });

type NavItem = { to: string; label: string; icon: React.ElementType; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

function AuthenticatedLayout() {
  const { session, loading, restaurant, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [waiterCalls, setWaiterCalls] = useState(0);
  const [newOrders, setNewOrders] = useState(0);

  const loadBadges = useCallback(async () => {
    if (!restaurant) return;
    const [{ count: calls }, { count: orders }] = await Promise.all([
      supabase.from("waiter_calls").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).eq("resolved", false),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).eq("status", "new"),
    ]);
    setWaiterCalls(calls ?? 0);
    setNewOrders(orders ?? 0);
  }, [restaurant]);

  useEffect(() => { void loadBadges(); }, [loadBadges]);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel(`nav-${restaurant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurant.id}` }, () => void loadBadges())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => void loadBadges())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurant, loadBadges]);

  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [session, loading, navigate]);

  useEffect(() => {
    if (!loading && session && !restaurant && location.pathname !== "/onboarding") navigate({ to: "/onboarding" });
  }, [restaurant, session, loading, location.pathname, navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (loading || !session) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (location.pathname === "/onboarding") return <Outlet />;
  if (!restaurant) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const GROUPS: NavGroup[] = [
    {
      label: "Visão geral",
      items: [
        { to: "/admin",            label: "Dashboard",   icon: LayoutDashboard },
        { to: "/admin/relatorios", label: "Relatórios",  icon: BarChart3 },
        { to: "/admin/caixa",      label: "Caixa",       icon: Wallet },
      ],
    },
    {
      label: "Operação",
      items: [
        { to: "/cozinha",          label: "Cozinha",     icon: ChefHat,     badge: newOrders > 0 ? newOrders : undefined },
        { to: "/garcom",           label: "Garçom",      icon: HandPlatter, badge: waiterCalls > 0 ? waiterCalls : undefined },
        { to: "/admin/pedidos",    label: "Pedidos",     icon: Receipt },
        { to: "/admin/delivery",   label: "Delivery",    icon: Bike },
      ],
    },
    {
      label: "Cardápio & Mesas",
      items: [
        { to: "/admin/produtos",   label: "Cardápio",    icon: Pizza },
        { to: "/admin/promocoes",  label: "Promoções",   icon: Sparkles },
        { to: "/admin/mesas",      label: "Mesas & QR",  icon: QrCode },
      ],
    },
    {
      label: "Administração",
      items: [
        { to: "/admin/equipe",        label: "Equipe",        icon: Users },
        { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
      ],
    },
  ];

  const ALL_ITEMS = GROUPS.flatMap(g => g.items);
  const BOTTOM_NAV = [
    ALL_ITEMS.find(i => i.to === "/admin")!,
    ALL_ITEMS.find(i => i.to === "/cozinha")!,
    ALL_ITEMS.find(i => i.to === "/garcom")!,
    ALL_ITEMS.find(i => i.to === "/admin/pedidos")!,
    ALL_ITEMS.find(i => i.to === "/admin/produtos")!,
  ];

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = location.pathname === item.to;
    const Icon = item.icon;
    return (
      <Link to={item.to}
        className={cn(
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
          active ? "bg-primary text-primary-foreground shadow-brand" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge != null && (
          <span className={cn("grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-extrabold",
            active ? "bg-white/20 text-white" : "bg-primary text-primary-foreground")}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-2 py-3 shrink-0">
        <BrandLogo className="[&_span:first-child]:text-sidebar-foreground [&_span:last-child]:text-sidebar-foreground/60" />
      </div>

      {/* Restaurant card */}
      <div className="mx-2 rounded-xl bg-sidebar-accent p-3 shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">Restaurante</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-sidebar-foreground">{restaurant.name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] text-sidebar-foreground/50">Operando</span>
        </div>
      </div>

      {/* Alerts */}
      {(waiterCalls > 0 || newOrders > 0) && (
        <div className="mx-2 mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 space-y-1 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
            <Bell className="h-3 w-3" />Atenção
          </div>
          {newOrders > 0 && <div className="text-xs text-amber-700 dark:text-amber-400">🍽️ {newOrders} pedido{newOrders > 1 ? "s" : ""} novo{newOrders > 1 ? "s" : ""}</div>}
          {waiterCalls > 0 && <div className="text-xs text-amber-700 dark:text-amber-400">🛎️ {waiterCalls} chamado{waiterCalls > 1 ? "s" : ""} pendente{waiterCalls > 1 ? "s" : ""}</div>}
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {GROUPS.map(group => (
          <div key={group.label}>
            <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map(item => <NavLink key={item.to} item={item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-1 shrink-0">
        <div className="px-3 py-1 text-[11px] text-sidebar-foreground/40 truncate">{user?.email}</div>
        <button onClick={() => { void signOut(); navigate({ to: "/login" }); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all">
          <LogOut className="h-4 w-4" />Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 border-r border-sidebar-border bg-sidebar shadow-2xl">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="rounded-full p-1.5 bg-sidebar-accent text-sidebar-foreground/70">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
            <BrandLogo />
          </div>
          <div className="flex items-center gap-2">
            {(waiterCalls + newOrders) > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-amber-500" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground grid place-items-center">
                  {Math.min(waiterCalls + newOrders, 9)}
                </span>
              </div>
            )}
            <button onClick={() => { void signOut(); navigate({ to: "/login" }); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav — 5 principais */}
        <nav className="grid grid-cols-5 border-t border-border bg-card lg:hidden shrink-0">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground")}>
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge != null && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground grid place-items-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
