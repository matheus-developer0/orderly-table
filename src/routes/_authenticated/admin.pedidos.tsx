import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Receipt, Clock, CheckCircle2, XCircle,
  Loader2, ChevronDown, ChevronUp, RefreshCw, X,
  AlertCircle, Printer, Filter,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({ component: PedidosPage });

type OS = "new"|"preparing"|"ready"|"out_for_delivery"|"delivered"|"cancelled";
type OI = { id:string; name_snapshot:string; quantity:number; price_snapshot:number; notes:string|null };
type Order = { id:string; status:OS; type:string; total:number; created_at:string; table_id:string|null; notes:string|null; cancel_reason:string|null; table_number:number|null; order_items:OI[] };

const SC:Record<OS,string>={new:"bg-yellow-500/10 text-yellow-700 border-yellow-500/30",preparing:"bg-blue-500/10 text-blue-700 border-blue-500/30",ready:"bg-green-500/10 text-green-700 border-green-500/30",out_for_delivery:"bg-purple-500/10 text-purple-700 border-purple-500/30",delivered:"bg-muted text-muted-foreground border-border",cancelled:"bg-destructive/10 text-destructive border-destructive/30"};
const SL:Record<OS,string>={new:"Novo",preparing:"Preparando",ready:"Pronto",out_for_delivery:"Saiu",delivered:"Entregue",cancelled:"Cancelado"};
const NEXT:Partial<Record<OS,OS>>={new:"preparing",preparing:"ready",ready:"out_for_delivery",out_for_delivery:"delivered"};

const fmt=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDt=(d:string)=>new Date(d).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
function ago(d:string){const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}min`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`;}

/* ── Detail Modal ── */
function DetailModal({order,onClose,onRefresh}:{order:Order;onClose:()=>void;onRefresh:()=>void}){
  const [saving,setSaving]=useState(false);
  const next=NEXT[order.status];

  const advance=async()=>{
    if(!next)return;
    setSaving(true);
    const{error}=await supabase.from("orders").update({status:next,updated_at:new Date().toISOString()}).eq("id",order.id);
    setSaving(false);
    if(error)return toast.error(error.message);
    toast.success(`Pedido → ${SL[next]}`);
    onRefresh();onClose();
  };

  const cancel=async()=>{
    if(!confirm("Cancelar este pedido?"))return;
    setSaving(true);
    await supabase.from("orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",order.id);
    setSaving(false);
    toast.success("Pedido cancelado");
    onRefresh();onClose();
  };

  const print=()=>{
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><title>Pedido</title><style>*{margin:0;padding:0}body{font-family:monospace;font-size:14px;padding:20px;max-width:300px;margin:auto}h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px}.row{display:flex;justify-content:space-between;margin:5px 0}.sep{border-top:2px dashed #000;margin:10px 0}.total{font-weight:900;font-size:16px}</style></head><body>
    <h2>${order.table_number?`MESA ${order.table_number}`:order.type==="delivery"?"DELIVERY":"BALCÃO"}</h2>
    <p style="text-align:center;color:#666">${fmtDt(order.created_at)}</p>
    ${order.order_items.map(i=>`<div class="row"><span>${i.quantity}× ${i.name_snapshot}</span><span>${fmt(i.price_snapshot*i.quantity)}</span></div>${i.notes?`<div style="font-size:11px;color:#666;margin-left:16px">⚠ ${i.notes}</div>`:""}`).join("")}
    ${order.notes?`<p style="background:#f5f5f5;padding:6px 10px;font-size:12px;margin:8px 0">📝 ${order.notes}</p>`:""}
    <div class="sep"></div><div class="row total"><span>TOTAL</span><span>${fmt(order.total)}</span></div>
    <div style="text-align:center;color:#999;font-size:11px;margin-top:8px">#${order.id.slice(0,8)}</div>
    </body></html>`);
    w.document.close();w.print();
  };

  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold">Pedido #{order.id.slice(0,8)}</h2>
          <p className="text-xs text-muted-foreground">{fmtDt(order.created_at)} · {order.table_number?`Mesa ${order.table_number}`:order.type==="delivery"?"Delivery":"Balcão"}</p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button>
      </div>
      <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold",SC[order.status])}>{SL[order.status]}</span>
          <span className="text-2xl font-extrabold text-primary ml-auto">{fmt(order.total)}</span>
        </div>
        <ul className="divide-y divide-border border rounded-xl overflow-hidden">
          {order.order_items.map(i=>(
            <li key={i.id} className="flex items-start justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{i.quantity}×</span>
                <div><span>{i.name_snapshot}</span>{i.notes&&<div className="text-xs text-amber-600">⚠️ {i.notes}</div>}</div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{fmt(i.price_snapshot*i.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.notes&&<div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">📝 {order.notes}</div>}
        {order.cancel_reason&&<div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">❌ Motivo: {order.cancel_reason}</div>}
      </div>
      <div className="px-6 py-4 border-t border-border flex gap-2">
        <button onClick={print} className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border text-xs font-semibold hover:bg-muted">
          <Printer className="h-4 w-4"/>Imprimir
        </button>
        {order.status!=="cancelled"&&order.status!=="delivered"&&(
          <button onClick={()=>void cancel()} disabled={saving} className="h-10 px-3 rounded-xl border border-destructive/30 text-destructive text-xs font-semibold hover:bg-destructive/10 disabled:opacity-60">
            Cancelar
          </button>
        )}
        {next&&(
          <button onClick={()=>void advance()} disabled={saving}
            className="flex-1 h-10 rounded-xl gradient-brand text-xs font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
            {saving?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:`Avançar → ${SL[next]}`}
          </button>
        )}
      </div>
    </motion.div>
  </>);
}

/* ── Main ── */
type FilterStatus="all"|"new"|"preparing"|"ready"|"delivered"|"cancelled";
type FilterType="all"|"dine_in"|"delivery";

function PedidosPage(){
  const {restaurant}=useAuth();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [fStatus,setFStatus]=useState<FilterStatus>("all");
  const [fType,setFType]=useState<FilterType>("all");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Order|null>(null);
  const [showFilters,setShowFilters]=useState(false);

  const load=useCallback(async()=>{
    if(!restaurant)return;
    const{data}=await supabase.from("orders")
      .select("id,status,type,total,created_at,table_id,notes,cancel_reason,order_items(id,name_snapshot,quantity,price_snapshot,notes)")
      .eq("restaurant_id",restaurant.id)
      .order("created_at",{ascending:false})
      .limit(300);
    const{data:tbs}=await supabase.from("tables").select("id,number").eq("restaurant_id",restaurant.id);
    const tm=Object.fromEntries((tbs??[]).map(t=>[t.id,t.number]));
    setOrders((data??[]).map(o=>({...o,status:o.status as OS,table_number:o.table_id?tm[o.table_id]??null:null,order_items:(o.order_items as OI[])?? []})));
    setLoading(false);
  },[restaurant]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!restaurant)return;
    const ch=supabase.channel(`orders-mgr-${restaurant.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`restaurant_id=eq.${restaurant.id}`},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(ch);};
  },[restaurant,load]);

  const filtered=orders.filter(o=>{
    const ms=fStatus==="all"||o.status===fStatus;
    const mt=fType==="all"||o.type===fType;
    const mq=!search||o.id.toLowerCase().includes(search.toLowerCase())||String(o.table_number??"").includes(search)||(o.notes??"").toLowerCase().includes(search.toLowerCase());
    return ms&&mt&&mq;
  });

  const counts:Record<string,number>={all:orders.length};
  for(const s of["new","preparing","ready","delivered","cancelled"])counts[s]=orders.filter(o=>o.status===s).length;
  const todayRevenue=orders.filter(o=>o.status==="delivered"&&o.created_at.startsWith(new Date().toISOString().slice(0,10))).reduce((s,o)=>s+o.total,0);

  return(
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{fmt(todayRevenue)} faturados hoje · {orders.length} registros</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowFilters(v=>!v)} className={cn("flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all",showFilters?"gradient-brand text-primary-foreground border-transparent":"border-border text-muted-foreground hover:bg-muted")}>
              <Filter className="h-3.5 w-3.5"/>Filtros
            </button>
            <button onClick={()=>void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
              <RefreshCw className="h-4 w-4"/>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por ID, mesa ou observação..." className="input-base pl-9 pr-9"/>
          {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4"/></button>}
        </div>

        {/* Status chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {(["all","new","preparing","ready","delivered","cancelled"] as FilterStatus[]).map(f=>(
            <button key={f} onClick={()=>setFStatus(f)}
              className={cn("shrink-0 flex items-center gap-1.5 rounded-xl px-3 h-8 text-xs font-semibold transition-all",fStatus===f?"gradient-brand text-primary-foreground shadow-brand":"border border-border text-muted-foreground hover:bg-muted")}>
              {f==="all"?"Todos":SL[f as OS]}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",fStatus===f?"bg-white/20":"bg-muted")}>{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Extra filters */}
        <AnimatePresence>
          {showFilters&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
              <div className="flex gap-2 pt-1">
                {(["all","dine_in","delivery"] as FilterType[]).map(t=>(
                  <button key={t} onClick={()=>setFType(t)}
                    className={cn("rounded-xl px-3 h-8 text-xs font-semibold border transition-all",fType===t?"gradient-brand text-primary-foreground border-transparent":"border-border text-muted-foreground hover:bg-muted")}>
                    {t==="all"?"Todos os tipos":t==="dine_in"?"🍽️ Mesa":"🛵 Delivery"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading?(
          <div className="space-y-2">{[...Array(8)].map((_,i)=><div key={i} className="h-16 rounded-2xl bg-muted animate-pulse"/>)}</div>
        ):filtered.length===0?(
          <div className="grid place-items-center rounded-2xl border border-dashed border-border p-20 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3"/>
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
            {(search||fStatus!=="all"||fType!=="all")&&<button onClick={()=>{setSearch("");setFStatus("all");setFType("all");}} className="mt-2 text-xs text-primary hover:underline">Limpar filtros</button>}
          </div>
        ):(
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((o,i)=>{
                const SIcon=o.status==="delivered"?CheckCircle2:o.status==="cancelled"?XCircle:o.status==="new"?AlertCircle:Clock;
                return(
                  <motion.button key={o.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:Math.min(i,20)*0.01}}
                    onClick={()=>setSelected(o)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated transition-all text-left">
                    <div className={cn("grid h-10 w-10 place-items-center rounded-xl border shrink-0",SC[o.status])}>
                      <SIcon className="h-4 w-4"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{o.table_number?`Mesa ${o.table_number}`:o.type==="delivery"?"🛵 Delivery":"🥡 Balcão"}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold",SC[o.status])}>{SL[o.status]}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">#{o.id.slice(0,8)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{fmtDt(o.created_at)}</span>
                        <span>·</span>
                        <span>{o.order_items.length} {o.order_items.length===1?"item":"itens"}</span>
                        <span>·</span>
                        <span>{ago(o.created_at)} atrás</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-base">{fmt(o.total)}</div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected&&<DetailModal order={selected} onClose={()=>setSelected(null)} onRefresh={load}/>}
      </AnimatePresence>
    </div>
  );
}
