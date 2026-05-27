import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Loader2, X, Check, Trash2,
  ChefHat, HandPlatter, ShieldCheck, DollarSign,
  Bike, Crown, UserCircle2, Phone, Info, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/equipe")({ component: EquipePage });

type AppRole = "owner"|"manager"|"waiter"|"kitchen"|"cashier"|"delivery";
type Member  = { id:string; user_id:string; role:AppRole; created_at:string; name:string|null; phone:string|null };

const RM: Record<AppRole, { label:string; desc:string; icon:React.ReactNode; color:string }> = {
  owner:    { label:"Dono",       desc:"Acesso total ao sistema",    icon:<Crown className="h-4 w-4"/>,       color:"bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  manager:  { label:"Gerente",    desc:"Admin e relatórios",         icon:<ShieldCheck className="h-4 w-4"/>, color:"bg-purple-500/10 text-purple-600 border-purple-500/20" },
  waiter:   { label:"Garçom",     desc:"Chamados, pedidos e contas", icon:<HandPlatter className="h-4 w-4"/>, color:"bg-blue-500/10 text-blue-600 border-blue-500/20" },
  kitchen:  { label:"Cozinheiro", desc:"Painel da cozinha",          icon:<ChefHat className="h-4 w-4"/>,    color:"bg-orange-500/10 text-orange-600 border-orange-500/20" },
  cashier:  { label:"Caixa",      desc:"Fechamento e pagamentos",    icon:<DollarSign className="h-4 w-4"/>, color:"bg-green-500/10 text-green-600 border-green-500/20" },
  delivery: { label:"Entregador", desc:"Painel de entregas",         icon:<Bike className="h-4 w-4"/>,       color:"bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
};

const INVITABLE: AppRole[] = ["manager","waiter","kitchen","cashier","delivery"];

/* ── Add/Edit Modal ── */
function MemberModal({ restaurantId, existingIds, initial, onClose, onSaved }: {
  restaurantId:string; existingIds:string[]; initial:Member|null; onClose:()=>void; onSaved:()=>void;
}) {
  const isNew = !initial;
  const [phone, setPhone] = useState(initial?.phone??"");
  const [role,  setRole]  = useState<AppRole>(initial?.role??"waiter");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!isNew) {
      // just change role
      setSaving(true);
      await supabase.from("user_roles").update({ role }).eq("id", initial!.id);
      setSaving(false);
      toast.success("Cargo atualizado!");
      onSaved(); onClose(); return;
    }
    if (!phone.trim()) return toast.error("Telefone obrigatório");
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("id").eq("phone", phone.trim()).maybeSingle();
    if (!profile) { setSaving(false); return toast.error("Usuário não encontrado. Verifique o telefone cadastrado na conta."); }
    if (existingIds.includes(profile.id)) { setSaving(false); return toast.error("Este usuário já está na equipe."); }
    const { error } = await supabase.from("user_roles").insert({ user_id:profile.id, restaurant_id:restaurantId, role });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Membro adicionado!");
    onSaved(); onClose();
  };

  return (<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{isNew?"Adicionar membro":"Editar cargo"}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button>
      </div>

      {isNew && (<>
        <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5"/>
          O colaborador precisa ter uma conta criada. Informe o telefone cadastrado na conta dele.
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone da conta</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <input autoFocus type="tel" value={phone} onChange={e=>setPhone(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&void save()} className="input-base pl-9" placeholder="(11) 99999-9999"/>
          </div>
        </div>
      </>)}

      {!isNew && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <UserCircle2 className="h-8 w-8 text-muted-foreground"/>
          <div>
            <div className="font-semibold">{initial?.name??`Usuário ${initial?.user_id.slice(0,6)}`}</div>
            {initial?.phone&&<div className="text-xs text-muted-foreground">{initial.phone}</div>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cargo</label>
        <div className="grid grid-cols-2 gap-2">
          {INVITABLE.map(r=>{
            const meta=RM[r]; const active=role===r;
            return(<button key={r} onClick={()=>setRole(r)}
              className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-all",active?"gradient-brand text-primary-foreground border-transparent shadow-brand":"border-border hover:bg-muted")}>
              <span className={cn("mt-0.5 shrink-0",!active&&"text-muted-foreground")}>{meta.icon}</span>
              <div>
                <div className="text-xs font-bold">{meta.label}</div>
                <div className={cn("text-[10px] leading-snug mt-0.5",active?"text-primary-foreground/80":"text-muted-foreground")}>{meta.desc}</div>
              </div>
            </button>);
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={()=>void save()} disabled={saving}
          className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
          {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<><Check className="h-4 w-4"/>{isNew?"Adicionar":"Salvar"}</>}
        </button>
      </div>
    </motion.div>
  </>);
}

/* ── Main ── */
function EquipePage() {
  const {restaurant, user} = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{open:boolean;member:Member|null}>({open:false,member:null});
  const [filterRole, setFilterRole] = useState<AppRole|"all">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!restaurant) return;
    const {data} = await supabase.from("user_roles").select("id,user_id,role,created_at").eq("restaurant_id",restaurant.id).order("created_at");
    if (!data) return setLoading(false);
    const userIds = data.map(m=>m.user_id);
    const {data:profiles} = await supabase.from("profiles").select("id,name,phone").in("id",userIds);
    const pm = Object.fromEntries((profiles??[]).map(p=>[p.id,p]));
    setMembers(data.map(m=>({...m,role:m.role as AppRole,name:pm[m.user_id]?.name??null,phone:pm[m.user_id]?.phone??null})));
    setLoading(false);
  },[restaurant]);

  useEffect(()=>{void load();},[load]);

  const remove = async (m:Member) => {
    if (m.role==="owner") return toast.error("Não é possível remover o dono.");
    if (!confirm(`Remover ${m.name??"este membro"} da equipe?`)) return;
    await supabase.from("user_roles").delete().eq("id",m.id);
    toast.success("Membro removido");
    void load();
  };

  const filtered = members.filter(m => {
    const mr = filterRole==="all"||m.role===filterRole;
    const ms = !search||(m.name??"").toLowerCase().includes(search.toLowerCase())||(m.phone??"").includes(search);
    return mr&&ms;
  });

  const roleCounts = members.reduce<Record<string,number>>((acc,m)=>({...acc,[m.role]:(acc[m.role]??0)+1}),{});

  const formatDate = (d:string) => new Date(d).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"});

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Administração</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Equipe</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{members.length} membro{members.length!==1?"s":""}</p>
          </div>
          <button onClick={()=>setModal({open:true,member:null})}
            className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
            <Plus className="h-4 w-4"/>Adicionar membro
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou telefone..." className="input-base pl-9 pr-9"/>
          {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4"/></button>}
        </div>

        {/* Role filter chips */}
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setFilterRole("all")}
            className={cn("rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",filterRole==="all"?"gradient-brand text-primary-foreground border-transparent shadow-brand":"border-border text-muted-foreground hover:bg-muted")}>
            Todos ({members.length})
          </button>
          {(Object.entries(RM) as [AppRole,typeof RM[AppRole]][]).filter(([r])=>roleCounts[r]).map(([r,meta])=>(
            <button key={r} onClick={()=>setFilterRole(r===filterRole?"all":r)}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",filterRole===r?"gradient-brand text-primary-foreground border-transparent shadow-brand":"border-border text-muted-foreground hover:bg-muted")}>
              {meta.icon}{meta.label} ({roleCounts[r]})
            </button>
          ))}
        </div>
      </div>

      {/* Permissions reference */}
      <div className="border-b border-border bg-muted/30 px-6 py-2.5 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {(Object.entries(RM) as [AppRole,typeof RM[AppRole]][]).map(([r,meta])=>(
            <div key={r} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",meta.color)}>
              {meta.icon}<span>{meta.label}</span><span className="opacity-60">— {meta.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-3 max-w-2xl">{[...Array(4)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-muted animate-pulse"/>)}</div>
        ) : filtered.length===0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="rounded-2xl border border-dashed border-border p-12 max-w-sm mx-auto space-y-3">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto"/>
              <p className="text-sm text-muted-foreground">{members.length===0?"Adicione garçons, cozinheiros e gerentes para começar.":"Nenhum membro encontrado."}</p>
              {members.length===0&&<button onClick={()=>setModal({open:true,member:null})} className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand">Adicionar primeiro membro</button>}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            <AnimatePresence mode="popLayout">
              {filtered.map(m => {
                const meta=RM[m.role]; const isMe=m.user_id===user?.id;
                return (
                  <motion.div key={m.id} layout initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,height:0}}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
                      <UserCircle2 className="h-6 w-6 text-muted-foreground"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {m.name??`Usuário ${m.user_id.slice(0,6)}`}
                          {isMe&&<span className="ml-1 text-[10px] text-muted-foreground">(você)</span>}
                        </span>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",meta.color)}>
                          {meta.icon}{meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {m.phone&&<span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{m.phone}</span>}
                        <span>desde {formatDate(m.created_at)}</span>
                      </div>
                    </div>
                    {!isMe&&m.role!=="owner"&&(
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={()=>setModal({open:true,member:m})}
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5"/>
                        </button>
                        <button onClick={()=>void remove(m)}
                          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5"/>
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
        {modal.open&&restaurant&&(
          <MemberModal
            restaurantId={restaurant.id}
            existingIds={members.map(m=>m.user_id)}
            initial={modal.member}
            onClose={()=>setModal({open:false,member:null})}
            onSaved={load}/>
        )}
      </AnimatePresence>
    </div>
  );
}
