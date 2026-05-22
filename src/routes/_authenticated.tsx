import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Pizza,
  Users,
  LogOut,
  Loader2,
  ChefHat,
  HandPlatter,
  QrCode,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/produtos", label: "Cardápio", icon: Pizza },
  { to: "/admin/mesas", label: "Mesas", icon: QrCode },
  { to: "/cozinha", label: "Cozinha", icon: ChefHat },
  { to: "/garcom", label: "Garçom", icon: HandPlatter },
  { to: "/admin/equipe", label: "Equipe", icon: Users },
] as const;

function AuthenticatedLayout() {
  const { session, loading, restaurant, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!loading && session && !restaurant && location.pathname !== "/onboarding") {
      navigate({ to: "/onboarding" });
    }
  }, [restaurant, session, loading, location.pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (location.pathname === "/onboarding") return <Outlet />;
  if (!restaurant) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <div className="px-2 py-3">
          <BrandLogo className="[&_span:first-child]:text-sidebar-foreground [&_span:last-child]:text-sidebar-foreground/60" />
        </div>
        <div className="mt-2 rounded-xl bg-sidebar-accent p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">
            Restaurante
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-sidebar-foreground">
            {restaurant.name}
          </div>
        </div>
        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-brand"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/50 truncate">
            {user?.email}
          </div>
          <button
            onClick={() => {
              void signOut();
              navigate({ to: "/login" });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <BrandLogo />
          <button
            onClick={() => {
              void signOut();
              navigate({ to: "/login" });
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="grid grid-cols-5 border-t border-border bg-card lg:hidden">
          {NAV.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// silence unused import warning
void UtensilsCrossed;
