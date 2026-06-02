import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat, Clock, Loader2, RefreshCw, Printer,
  Volume2, VolumeX, X, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cozinha")({ component: CozinhaPage });

type OS = "new"|"preparing"|"ready"|"out_for_delivery"|"delivered"|"cancelled";
type OI = { id:string; name_snapshot:string; quantity:number; notes:string|null };
type Order = { id:string; status:OS; created_at:string; notes:string|null; total:number; type:string; table_id:string|null; table_number:number|null; order_items:OI[]; printed:boolean };

const COLS:{key:OS;label:string;accent:string;ring:string}[] = [
  {key:"new",         label:"🆕 Novos",   accent:"bg-yellow-500", ring:"ring-yellow-500/30 bg-yellow-500/5"},
  {key:"preparing",   label:"👨‍🍳 Preparo", accent:"bg-blue-500",   ring:"ring-blue-500/30 bg-blue-500/5"},
  {key:"ready",       label:"✅ Pronto",   accent:"bg-green-500",  ring:"ring-green-500/30 bg-green-500/5"},
  {key:"out_for_delivery",label:"🛵 Saiu",accent:"bg-purple-500",ring:"ring-purple-500/30 bg-purple-500/5"},
];

const NEXT:Partial<Record<OS,OS>>={new:"preparing",preparing:"ready",ready:"out_for_delivery",out_for_delivery:"delivered"};
const PREV:Partial<Record<OS,OS>>={preparing:"new",ready:"preparing",out_for_delivery:"ready"};
const NEXT_LBL:Partial<Record<OS,string>>={new:"Iniciar preparo",preparing:"Marcar pronto",ready:"Despachar",out_for_delivery:"Entregue ✓"};

const fmt=(n:number)=>`R$ ${n.toFixed(2).replace(".",",")}`;
function elapsed(d:string){const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}min`;return`${Math.floor(s/3600)}h`;}

function CancelModal({onConfirm,onClose}:{onConfirm:(r:string)=>void;onClose:()=>void}){
  const [r,setR]=useState("");
  const opts=["Produto em falta","Pedido duplicado","Cliente desistiu","Erro no pedido","Outro"];
  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Cancelar pedido</h2><button onClick={onClose}><X className="h-5 w-5 text-muted-foreground"/></button></div>
      <p className="text-sm text-muted-foreground">Selecione ou escreva o motivo:</p>
      <div className="space-y-2">
        {opts.map(o=><button key={o} onClick={()=>setR(o)} className={cn("w-full rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-all",r===o?"gradient-brand text-primary-foreground border-transparent":"border-border hover:bg-muted")}>{o}</button>)}
        <input value={r} onChange={e=>setR(e.target.value)} placeholder="Outro motivo..." className="input-base"/>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Voltar</button>
        <button onClick={()=>r.trim()&&onConfirm(r)} disabled={!r.trim()} className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-40">Cancelar pedido</button>
      </div>
    </motion.div>
  </>);
}

function OrderCard({order,onMove,onCancel,onPrint,moving}:{order:Order;onMove:(id:string,s:OS)=>void;onCancel:(id:string)=>void;onPrint:(o:Order)=>void;moving:string|null}){
  const next=NEXT[order.status]; const prev=PREV[order.status];
  const busy=moving===order.id;
  const mins=Math.floor((Date.now()-new Date(order.created_at).getTime())/60000);
  const late=mins>20;
  return(
    <motion.div layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.9}}
      className={cn("rounded-2xl border bg-card p-4 shadow-card space-y-3 transition-all",late&&"ring-2 ring-red-500/50",order.status==="new"&&"ring-2 ring-yellow-500/40",busy&&"opacity-50 pointer-events-none")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {order.table_number?`Mesa ${order.table_number}`:order.type==="delivery"?"🛵 Delivery":"🥡 Balcão"}
          </div>
          <div className={cn("mt-1 flex items-center gap-1.5 text-xs font-semibold",late?"text-red-500":"text-muted-foreground")}>
            <Clock className="h-3 w-3"/>{elapsed(order.created_at)}
            {late&&<span className="rounded-full bg-red-500/10 px-1.5 text-[10px] font-black text-red-500">ATRASADO</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={()=>onPrint(order)} title={order.printed?"Reimprimir":"Imprimir"}
            className={cn("grid h-7 w-7 place-items-center rounded-lg transition-colors hover:bg-muted",order.printed?"text-green-500":"text-muted-foreground")}>
            <Printer className="h-3.5 w-3.5"/>
          </button>
          <button onClick={()=>onCancel(order.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {order.order_items.map(i=>(
          <li key={i.id} className="flex items-start gap-2">
            <span className="shrink-0 min-w-[22px] h-5 rounded bg-primary/10 text-primary text-[11px] font-black grid place-items-center px-1">{i.quantity}×</span>
            <div><span className="text-sm font-medium leading-tight">{i.name_snapshot}</span>
              {i.notes&&<div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">⚠️ {i.notes}</div>}
            </div>
          </li>
        ))}
      </ul>

      {order.notes&&<div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">📝 {order.notes}</div>}

      <div className="text-right text-xs font-bold text-muted-foreground">{fmt(order.total)}</div>

      <div className="flex gap-2 pt-1">
        {prev&&<button onClick={()=>onMove(order.id,prev)} className="flex-1 h-8 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors">← Voltar</button>}
        {next&&(
          <button onClick={()=>onMove(order.id,next)} disabled={busy}
            className="flex-1 h-8 rounded-lg gradient-brand text-xs font-black text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform flex items-center justify-center">
            {busy?<Loader2 className="h-3 w-3 animate-spin"/>:NEXT_LBL[order.status]}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CozinhaPage(){
  const {restaurant}=useAuth();
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [moving,setMoving]=useState<string|null>(null);
  const [cancelTarget,setCancelTarget]=useState<string|null>(null);
  const [soundOn,setSoundOn]=useState(true);
  const [filter,setFilter]=useState<"all"|"new">("all");
  const prevNewIds=useRef<Set<string>>(new Set());
  const [tick,setTick]=useState(0);

  const beep=useCallback(()=>{
    if(!soundOn)return;
    try{
      const ctx=new AudioContext();
      [[880,0],[1100,0.15],[880,0.30]].forEach(([freq,t])=>{
        const o=ctx.createOscillator();const g=ctx.createGain();
        o.connect(g);g.connect(ctx.destination);
        o.frequency.value=freq as number;
        g.gain.setValueAtTime(0.3,ctx.currentTime+(t as number));
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+(t as number)+0.12);
        o.start(ctx.currentTime+(t as number));o.stop(ctx.currentTime+(t as number)+0.13);
      });
    }catch{}
  },[soundOn]);

  const load=useCallback(async()=>{
    if(!restaurant)return;
    const{data}=await supabase.from("orders")
      .select("id,status,created_at,notes,total,type,table_id,printed,order_items(id,name_snapshot,quantity,notes)")
      .eq("restaurant_id",restaurant.id)
      .in("status",["new","preparing","ready","out_for_delivery"])
      .order("created_at");
    if(!data)return;
    const tableIds=[...new Set(data.map(o=>o.table_id).filter(Boolean))] as string[];
    let tm:Record<string,number>={};
    if(tableIds.length){const{data:tbs}=await supabase.from("tables").select("id,number").in("id",tableIds);tm=Object.fromEntries((tbs??[]).map(t=>[t.id,t.number]));}
    const enriched=data.map(o=>({...o,table_number:o.table_id?tm[o.table_id]??null:null,order_items:(o.order_items as OI[])??[]}));
    const newIds=new Set(enriched.filter(o=>o.status==="new").map(o=>o.id));
    let hasNew=false;for(const id of newIds){if(!prevNewIds.current.has(id)){hasNew=true;break;}}
    if(hasNew)beep();
    prevNewIds.current=newIds;
    setOrders(enriched);setLoading(false);
  },[restaurant,beep]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!restaurant)return;
    const ch=supabase.channel(`kitchen-${restaurant.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`restaurant_id=eq.${restaurant.id}`},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(ch);};
  },[restaurant,load]);
  useEffect(()=>{const t=setInterval(()=>setTick(v=>v+1),30000);return()=>clearInterval(t);},[]);

  const move=async(id:string,status:OS,reason?:string)=>{
    setMoving(id);
    const patch={status,updated_at:new Date().toISOString(),...(reason?{cancel_reason:reason}:{})};
    const{error}=await supabase.from("orders").update(patch).eq("id",id);
    setMoving(null);
    if(error)return toast.error(error.message);
    if(status==="cancelled")toast.success("Pedido cancelado");
    else if(status==="delivered")toast.success("Pedido entregue!");
    else toast.success("Status atualizado");
    void load();
  };

  const print=(order:Order)=>{
    const w=window.open("","_blank");if(!w)return;
    const t=new Date(order.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    w.document.write(`<html><head><title>Pedido</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:14px;padding:20px;max-width:300px;margin:auto}
    h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px;font-size:18px}
    .row{margin:5px 0}.qty{font-weight:900}.note{font-size:11px;color:#666;margin-left:16px}
    .obs{background:#f5f5f5;padding:6px 10px;border-radius:4px;font-size:12px;margin:8px 0}
    .sep{border-top:2px dashed #000;margin:10px 0}
    .total{display:flex;justify-content:space-between;font-weight:900;font-size:16px}
    .footer{text-align:center;color:#999;font-size:11px;margin-top:8px}
    </style></head><body>
    <h2>${order.table_number?`MESA ${order.table_number}`:order.type==="delivery"?"DELIVERY":"BALCÃO"}</h2>
    <p style="text-align:center;color:#666;margin-bottom:8px">${t}</p>
    ${order.order_items.map(i=>`<div class="row"><span class="qty">${i.quantity}×</span> ${i.name_snapshot}${i.notes?`<div class="note">⚠ ${i.notes}</div>`:""}</div>`).join("")}
    ${order.notes?`<div class="obs">📝 ${order.notes}</div>`:""}
    <div class="sep"></div>
    <div class="total"><span>TOTAL</span><span>${fmt(Number(order.total))}</span></div>
    <div class="footer">#${order.id.slice(0,8)}</div>
    </body></html>`);
    w.document.close();w.print();
    void supabase.from("orders").update({printed:true}).eq("id",order.id);
    setOrders(prev=>prev.map(o=>o.id===order.id?{...o,printed:true}:o));
  };

  const shown=filter==="all"?orders:orders.filter(o=>o.status==="new");
  const newCount=orders.filter(o=>o.status==="new").length;
  const _ = tick; // keep tick alive

  if(loading)return<div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>;

  return(
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand"><ChefHat className="h-4 w-4 text-primary-foreground"/></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Painel</div>
            <h1 className="text-xl font-extrabold tracking-tight">Cozinha</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(["all","new"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={cn("px-3 h-8 text-xs font-semibold transition-all",filter===f?"gradient-brand text-primary-foreground":"text-muted-foreground hover:bg-muted")}>
                {f==="all"?`Todos (${orders.length})`:`Novos${newCount>0?` (${newCount})`:""}`}
              </button>
            ))}
          </div>
          {newCount>0&&<span className="rounded-full gradient-brand px-3 py-1 text-xs font-black text-primary-foreground shadow-brand animate-pulse">{newCount} novo{newCount>1?"s":""}</span>}
          <button onClick={()=>setSoundOn(v=>!v)}
            className={cn("grid h-8 w-8 place-items-center rounded-lg border transition-colors",soundOn?"border-primary/30 text-primary":"border-border text-muted-foreground")}>
            {soundOn?<Volume2 className="h-3.5 w-3.5"/>:<VolumeX className="h-3.5 w-3.5"/>}
          </button>
          <button onClick={()=>void load()} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 px-6 py-2 bg-card border-b border-border shrink-0 text-xs text-muted-foreground">
        {COLS.map(col=>{
          const n=orders.filter(o=>o.status===col.key).length;
          return<div key={col.key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full",col.accent)}/>
            <span className="font-semibold">{col.label.replace(/.*\s/,"")}</span>
            <span className="font-black text-foreground">{n}</span>
          </div>;
        })}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-4">
        {orders.length===0?(
          <div className="grid place-items-center h-full py-24">
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-16 w-16 text-success/30 mx-auto"/>
              <p className="text-lg font-bold text-muted-foreground">Nenhum pedido ativo</p>
              <p className="text-sm text-muted-foreground">Os pedidos aparecerão aqui em tempo real</p>
            </div>
          </div>
        ):(
          <div className="flex gap-4 h-full min-w-max">
            {COLS.map(col=>{
              const list=shown.filter(o=>o.status===col.key);
              return(
                <div key={col.key} className="w-72 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0",col.accent)}/>
                    <span className="text-sm font-black">{col.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-black text-muted-foreground">{list.length}</span>
                  </div>
                  <div className={cn("flex-1 rounded-2xl ring-1 p-3 space-y-3 min-h-[300px]",col.ring)}>
                    <AnimatePresence mode="popLayout">
                      {list.length===0&&(
                        <motion.div initial={{opacity:0}} animate={{opacity:0.4}} className="grid place-items-center py-16 text-xs text-muted-foreground flex-col gap-2">
                          <AlertTriangle className="h-6 w-6 opacity-30"/>Nenhum pedido
                        </motion.div>
                      )}
                      {list.map(order=>(
                        <OrderCard key={order.id} order={order} moving={moving}
                          onMove={(id,s)=>void move(id,s)}
                          onCancel={id=>setCancelTarget(id)}
                          onPrint={print}/>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {cancelTarget&&(
          <CancelModal
            onConfirm={reason=>{void move(cancelTarget,"cancelled",reason);setCancelTarget(null);}}
            onClose={()=>setCancelTarget(null)}/>
        )}
      </AnimatePresence>
    </div>
  );
}
