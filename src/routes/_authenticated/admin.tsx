import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  Users,
  ArrowUpRight,
  QrCode,
  Pizza,
  ChefHat,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

const STATS = [
  { label: "Faturamento hoje", value: "R$ 0,00", change: "+0%", icon: TrendingUp },
  { label: "Pedidos do dia", value: "0", change: "+0", icon: ShoppingBag },
  { label: "Ticket médio", value: "R$ 0,00", change: "—", icon: Receipt },
  { label: "Mesas ativas", value: "0", change: "—", icon: Users },
];

const QUICK_ACTIONS = [
  {
    to: "/admin/mesas",
    title: "Gerar QR Codes",
    desc: "Imprima e cole nas mesas.",
    icon: QrCode,
  },
  {
    to: "/admin/produtos",
    title: "Editar cardápio",
    desc: "Adicione produtos e fotos.",
    icon: Pizza,
  },
  {
    to: "/cozinha",
    title: "Abrir cozinha",
    desc: "Painel kanban em tempo real.",
    icon: ChefHat,
  },
];

function AdminDashboard() {
  const { restaurant } = useAuth();

  return (
    <div className="space-y-8 p-6 lg:p-10">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Olá, {restaurant?.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a operação do seu restaurante em tempo real.
        </p>
      </motion.header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-success">{s.change}</span>
              </div>
              <div className="mt-4 text-2xl font-extrabold tracking-tight">
                {s.value}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Primeiros passos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((q, i) => {
            const Icon = q.icon;
            return (
              <motion.div
                key={q.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <Link
                  to={q.to}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between">
                    <div className="grid h-11 w-11 place-items-center rounded-xl gradient-brand shadow-brand">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div className="mt-5 text-base font-bold">{q.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{q.desc}</div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <div className="mx-auto max-w-md space-y-2">
          <h3 className="text-base font-bold">Pronto para a próxima fase?</h3>
          <p className="text-sm text-muted-foreground">
            A Fase 1 está completa. Peça para liberar a{" "}
            <span className="font-semibold text-foreground">Fase 2</span> e teremos o
            cardápio digital interativo via QR Code com carrinho compartilhado em
            tempo real.
          </p>
        </div>
      </section>
    </div>
  );
}
