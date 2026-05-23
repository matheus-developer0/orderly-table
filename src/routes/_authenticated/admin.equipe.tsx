import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Loader2, X, Check, Trash2,
  ChefHat, HandPlatter, ShieldCheck, DollarSign,
  Bike, Crown, Mail, UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: EquipePage,
});

type AppRole = "owner" | "manager" | "waiter" | "kitchen" | "cashier" | "delivery";

type Member = {
  id: string;
  user_id: string;
  role: AppRole;
  email: string;
  name: string | null;
  created_at: string;
};

const ROLE_META: Record<AppRole, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  owner: {
    label: "Dono",
    desc: "Acesso total ao sistema",
    icon: <Crown className="h-4 w-4" />,
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  manager: {
    label: "Gerente",
    desc: "Acesso ao admin e relatórios",
    icon: <ShieldCheck className="h-4 w-4" />,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  waiter: {
    label: "Garçom",
    desc: "Painel de chamados e pedidos",
    icon: <HandPlatter className="h-4 w-4" />,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  kitchen: {
    label: "Cozinheiro",
    desc: "Painel da cozinha (kanban)",
    icon: <ChefHat className="h-4 w-4" />,
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  cashier: {
    label: "Caixa",
    desc: "Fechamento e pagamentos",
    icon: <DollarSign className="h-4 w-4" />,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  delivery: {
    label: "Entregador",
    desc: "Painel de entregas",
    icon: <Bike className="h-4 w-4" />,
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  },
};

const INVITABLE_ROLES: AppRole[] = ["manager", "waiter", "kitchen", "cashier", "delivery"];

function InviteModal({ restaurantId, onClose, onSaved }: {
  restaurantId: string; onClose: () => void; onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("waiter");
  const [saving, setSaving] = useState(false);

  const invite = async () => {
    if (!email.trim() || !email.includes("@")) return toast.error("E-mail inválido");
    setSaving(true);

    // Check if user exists by email via auth (we look up profiles)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,restaurant_id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (!profile) {
      setSaving(false);
      return toast.error("Usuário não encontrado. Peça para ele criar uma conta primeiro em /signup.");
    }

    // Check if already member
    const { data: existing } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", profile.id)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (existing) {
      setSaving(false);
      return toast.error("Este usuário já faz parte da equipe.");
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: profile.id,
      restaurant_id: restaurantId,
      role,
    });

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Membro adicionado à equipe!");
    onSaved();
    onClose();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">Adicionar membro</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-mail do colaborador</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void invite()}
                className="input-base pl-9"
                placeholder="colaborador@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cargo</label>
            <div className="grid grid-cols-2 gap-2">
              {INVITABLE_ROLES.map((r) => {
                const meta = ROLE_META[r];
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                      role === r
                        ? "gradient-brand text-primary-foreground border-transparent shadow-brand"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className={cn("mt-0.5 shrink-0", role !== r && "text-muted-foreground")}>
                      {meta.icon}
                    </span>
                    <div>
                      <div className="text-xs font-bold">{meta.label}</div>
                      <div className={cn("text-[10px] leading-snug mt-0.5", role === r ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {meta.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button onClick={() => void invite()} disabled={saving}
            className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Adicionar</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

function EquipePage() {
  const { restaurant, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filterRole, setFilterRole] = useState<AppRole | "all">("all");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("user_roles")
      .select("id,user_id,role,created_at")
      .eq("restaurant_id", restaurant.id)
      .order("created_at");

    if (!data) return setLoading(false);

    // Get profile info for each member
    const userIds = data.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .in("id", userIds);

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    setMembers(
      data.map((m) => ({
        ...m,
        role: m.role as AppRole,
        email: profileMap[m.user_id]?.email ?? "—",
        name: profileMap[m.user_id]?.full_name ?? null,
      })),
    );
    setLoading(false);
  }, [restaurant]);

  useEffect(() => { void load(); }, [load]);

  const removeMember = async (m: Member) => {
    if (m.role === "owner") return toast.error("Não é possível remover o dono.");
    if (!confirm(`Remover ${m.name ?? m.email} da equipe?`)) return;
    await supabase.from("user_roles").delete().eq("id", m.id);
    toast.success("Membro removido");
    void load();
  };

  const changeRole = async (m: Member, role: AppRole) => {
    if (m.role === "owner") return toast.error("Não é possível alterar o cargo do dono.");
    await supabase.from("user_roles").update({ role }).eq("id", m.id);
    toast.success("Cargo atualizado");
    void load();
  };

  const filtered = filterRole === "all" ? members : members.filter((m) => m.role === filterRole);

  const roleCounts = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gestão</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Equipe</h1>
            <p className="mt-1 text-sm text-muted-foreground">{members.length} membro{members.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform"
          >
            <Plus className="h-4 w-4" />Adicionar membro
          </button>
        </div>

        {/* Role summary chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterRole("all")}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
              filterRole === "all" ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            Todos ({members.length})
          </button>
          {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][])
            .filter(([r]) => roleCounts[r])
            .map(([r, meta]) => (
              <button
                key={r}
                onClick={() => setFilterRole(r === filterRole ? "all" : r)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                  filterRole === r ? "gradient-brand text-primary-foreground border-transparent shadow-brand" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {meta.icon}
                {meta.label} ({roleCounts[r]})
              </button>
            ))}
        </div>
      </div>

      {/* Permissions reference */}
      <div className="border-b border-border bg-muted/30 px-6 py-3">
        <div className="flex flex-wrap gap-3">
          {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][]).map(([r, meta]) => (
            <div key={r} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium", meta.color)}>
              {meta.icon}{meta.label}
            </div>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="rounded-2xl border border-dashed border-border p-12 max-w-sm mx-auto space-y-3">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {members.length === 0
                  ? "Nenhum membro na equipe ainda. Adicione garçons, cozinheiros e gerentes."
                  : "Nenhum membro com este cargo."}
              </p>
              {members.length === 0 && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand"
                >
                  Adicionar primeiro membro
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            <AnimatePresence mode="popLayout">
              {filtered.map((m) => {
                const meta = ROLE_META[m.role];
                const isMe = m.user_id === user?.id;
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <UserCircle2 className="h-6 w-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {m.name ?? m.email}
                          {isMe && <span className="ml-1 text-[10px] text-muted-foreground">(você)</span>}
                        </span>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", meta.color)}>
                          {meta.icon}{meta.label}
                        </span>
                      </div>
                      {m.name && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
                    </div>

                    {!isMe && m.role !== "owner" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={m.role}
                          onChange={(e) => void changeRole(m, e.target.value as AppRole)}
                          className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium outline-none cursor-pointer"
                        >
                          {INVITABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_META[r].label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => void removeMember(m)}
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {inviteOpen && restaurant && (
          <InviteModal
            restaurantId={restaurant.id}
            onClose={() => setInviteOpen(false)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
