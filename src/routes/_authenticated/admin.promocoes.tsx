import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Tag, Percent, Gift, Plus, Calendar, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/promocoes")({
  component: PromocoesPage,
});

type Promo = {
  id: string;
  title: string;
  type: "percent" | "fixed" | "combo";
  value: string;
  active: boolean;
  scope: string;
};

const DEMO: Promo[] = [
  { id: "1", title: "Happy Hour Chopp", type: "percent", value: "30% OFF", active: true, scope: "Bebidas · 17h às 19h" },
  { id: "2", title: "Combo Família", type: "combo", value: "R$ 89,90", active: true, scope: "2 pizzas grandes + refri 2L" },
  { id: "3", title: "Terça do Hambúrguer", type: "fixed", value: "R$ 19,90", active: false, scope: "Burger clássico · terças" },
];

function PromocoesPage() {
  const [promos, setPromos] = useState<Promo[]>(DEMO);

  const toggle = (id: string) => {
    setPromos((p) => p.map((x) => x.id === id ? { ...x, active: !x.active } : x));
    toast.success("Status atualizado");
  };

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
          onClick={() => toast("Em breve: criar promoção")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-brand hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova promoção
        </button>
      </header>

      {/* Templates */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Templates rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Percent, title: "Desconto %", desc: "Aplica desconto percentual em categorias ou produtos" },
            { icon: Gift, title: "Combo", desc: "Agrupe produtos com preço promocional" },
            { icon: Calendar, title: "Por horário", desc: "Happy hour, almoço executivo, terça especial" },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.title} onClick={() => toast.info("Template selecionado")}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="font-bold">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active promos */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Suas promoções</h2>
        <div className="space-y-2">
          {promos.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${
                p.type === "percent" ? "bg-emerald-500/10 text-emerald-600" :
                p.type === "combo" ? "bg-purple-500/10 text-purple-600" :
                "bg-amber-500/10 text-amber-600"
              }`}>
                {p.type === "percent" ? <Percent className="h-5 w-5" /> :
                 p.type === "combo" ? <Gift className="h-5 w-5" /> : <Tag className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.title}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{p.value}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.scope}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold ${p.active ? "text-success" : "text-muted-foreground"}`}>
                  {p.active ? "Ativa" : "Pausada"}
                </span>
                <button onClick={() => toggle(p.id)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${p.active ? "bg-primary" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Insights */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">Sugestão da IA</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Seus pedidos caem entre 14h e 17h. Que tal criar uma promoção de "Lanche da tarde" com 20% OFF?
            </p>
            <button className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
              Criar agora
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
