import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bike, MapPin, Phone, Clock, CheckCircle2, Loader2, Package, Plus, X, Check, RefreshCw, User, DollarSign, Printer, MessageCircle, Copy, Navigation } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/delivery")({ component: DeliveryPage });

type DS="new"|"preparing"|"ready"|"out_for_delivery"|"delivered";
type OI={id:string;name_snapshot:string;quantity:number;price_snapshot:number;notes:string|null};
type DeliveryOrder={id:string;status:DS;total:number;created_at:string;notes:string|null;customer_name:string|null;customer_phone:string|null;delivery_address:string|null;order_items:OI[]};

const COLS:{key:DS;label:string;dot:string;ring:string}[]=[
  {key:"new",              label:"📥 Recebidos",  dot:"bg-yellow-500",ring:"border-yellow-500/30 bg-yellow-500/5"},
  {key:"preparing",        label:"👨‍🍳 Preparando",  dot:"bg-blue-500",  ring:"border-blue-500/30 bg-blue-500/5"},
  {key:"ready",            label:"📦 Pronto",     dot:"bg-green-500", ring:"border-green-500/30 bg-green-500/5"},
  {key:"out_for_delivery", label:"🛵 Em rota",    dot:"bg-purple-500",ring:"border-purple-500/30 bg-purple-500/5"},
  {key:"delivered",        label:"✅ Entregues",  dot:"bg-muted-foreground",ring:"border-border bg-muted/10"},
];
const NEXT:Partial<Record<DS,DS>>={new:"preparing",preparing:"ready",ready:"out_for_delivery",out_for_delivery:"delivered"};
const NL:Partial<Record<DS,string>>={new:"Iniciar",preparing:"Pronto",ready:"Despachar 🛵",out_for_delivery:"Entregue ✓"};
const fmt=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function ago(d:string){const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}min`;return`${Math.floor(s/3600)}h`;}
const onlyDigits=(s:string|null|undefined)=>(s??"").replace(/\D/g,"");
function waLink(phone:string|null|undefined,msg:string){
  const p=onlyDigits(phone);if(!p)return null;
  const full=p.startsWith("55")?p:`55${p}`;
  return`https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}
function mapsLink(addr:string|null|undefined){
  if(!addr)return null;
  return`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

/* ── New Order Modal ── */
function NewModal({restaurantId,onClose,onSaved}:{restaurantId:string;onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({name:"",phone:"",address:"",notes:"",total:""});
  const [saving,setSaving]=useState(false);
  const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));

  const save=async()=>{
    if(!form.name.trim())return toast.error("Nome obrigatório");
    if(!form.address.trim())return toast.error("Endereço obrigatório");
    if(!form.total||isNaN(Number(form.total))||Number(form.total)<=0)return toast.error("Valor inválido");
    setSaving(true);
    const{error}=await supabase.from("orders").insert({
      restaurant_id:restaurantId,status:"new",type:"delivery",
      total:Number(form.total),notes:form.notes||null,
      customer_name:form.name.trim(),customer_phone:form.phone.trim()||null,
      delivery_address:form.address.trim(),
    });
    setSaving(false);
    if(error)return toast.error(error.message);
    toast.success("Pedido de delivery criado!");
    onSaved();onClose();
  };

  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Novo pedido delivery</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button>
      </div>
      <div className="space-y-3">
        {[{l:"Nome do cliente *",k:"name",ic:User,ph:"João Silva",t:"text"},{l:"Telefone",k:"phone",ic:Phone,ph:"(11) 99999-9999",t:"tel"},{l:"Endereço *",k:"address",ic:MapPin,ph:"Rua Exemplo, 123 - Bairro",t:"text"},{l:"Valor total (R$) *",k:"total",ic:DollarSign,ph:"0.00",t:"number"}].map(f=>{
          const Icon=f.ic;
          return(<div key={f.k} className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{f.l}</label>
            <div className="relative"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <input type={f.t} value={form[f.k as keyof typeof form]} onChange={e=>set(f.k,e.target.value)} className="input-base pl-9" placeholder={f.ph}/></div>
          </div>);
        })}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</label>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={2} className="input-base resize-none" placeholder="Sem cebola, portão azul..."/>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={()=>void save()} disabled={saving}
          className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
          {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<><Check className="h-4 w-4"/>Criar pedido</>}
        </button>
      </div>
    </motion.div>
  </>);
}

/* ── Delivery Card ── */
function DeliveryCard({order,onAdvance,onPrint}:{order:DeliveryOrder;onAdvance:(id:string,next:DS)=>void;onPrint:(o:DeliveryOrder)=>void}){
  const [open,setOpen]=useState(false);
  const next=NEXT[order.status];
  const mins=Math.floor((Date.now()-new Date(order.created_at).getTime())/60000);
  const late=mins>45&&order.status!=="delivered";

  return(
    <motion.div layout initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}
      className={cn("rounded-2xl bg-card border border-border shadow-card overflow-hidden",late&&"ring-1 ring-red-500/40")}>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">#{order.id.slice(0,8)}</span>
          <span className={cn("flex items-center gap-1 text-[10px] font-bold",late?"text-red-500":"text-muted-foreground")}>
            <Clock className="h-3 w-3"/>{ago(order.created_at)}{late&&" ⚠️"}
          </span>
        </div>
        {order.customer_name&&<div className="flex items-center gap-1.5 text-sm font-semibold"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>{order.customer_name}</div>}
        {(order.delivery_address||order.notes)&&(
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5"/>
            <span className="line-clamp-2">{order.delivery_address??order.notes}</span>
          </div>
        )}
        {order.customer_phone&&(
          <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Phone className="h-3.5 w-3.5"/>{order.customer_phone}
          </a>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="font-extrabold text-sm">{fmt(order.total)}</span>
          <div className="flex gap-1">
            {order.delivery_address&&(
              <a href={mapsLink(order.delivery_address)!} target="_blank" rel="noreferrer" title="Abrir no Maps"
                 className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-blue-600 transition-colors">
                <Navigation className="h-3.5 w-3.5"/>
              </a>
            )}
            {order.delivery_address&&(
              <button onClick={()=>{void navigator.clipboard.writeText(order.delivery_address!);toast.success("Endereço copiado");}} title="Copiar endereço"
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <Copy className="h-3.5 w-3.5"/>
              </button>
            )}
            {order.customer_phone&&(()=>{
              const url=waLink(order.customer_phone,`Olá ${order.customer_name??""}! Recebemos seu pedido #${order.id.slice(0,8)}. Em breve entraremos em contato 🍔`);
              return url?<a href={url} target="_blank" rel="noreferrer" title="WhatsApp"
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-green-600 transition-colors">
                <MessageCircle className="h-3.5 w-3.5"/></a>:null;
            })()}
            <button onClick={()=>onPrint(order)} title="Imprimir" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <Printer className="h-3.5 w-3.5"/>
            </button>
            <button onClick={()=>setOpen(v=>!v)} title="Itens" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <Package className="h-3.5 w-3.5"/>
            </button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{height:0}} animate={{height:"auto"}} exit={{height:0}} className="overflow-hidden border-t border-border">
            <ul className="px-4 py-3 space-y-1 text-xs">
              {order.order_items.map(i=>(
                <li key={i.id} className="flex justify-between gap-2">
                  <span>{i.quantity}× {i.name_snapshot}{i.notes&&` (${i.notes})`}</span>
                  <span className="text-muted-foreground shrink-0">{fmt(i.price_snapshot*i.quantity)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      {next&&(
        <button onClick={()=>onAdvance(order.id,next)}
          className="flex w-full items-center justify-center py-2.5 text-xs font-bold gradient-brand text-primary-foreground shadow-brand hover:opacity-90 transition-opacity">
          {NL[order.status]}
        </button>
      )}
      {order.status==="delivered"&&(
        <div className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5"/>Entregue
        </div>
      )}
    </motion.div>
  );
}

/* ── Dispatch Modal (ready → out_for_delivery) ── */
function DispatchModal({order,onClose,onConfirm}:{order:DeliveryOrder;onClose:()=>void;onConfirm:(eta:number,sendWa:boolean)=>void}){
  const [eta,setEta]=useState(30);
  const [sendWa,setSendWa]=useState(true);
  const hasPhone=!!onlyDigits(order.customer_phone);
  const preview=`Olá ${order.customer_name??""}! 🛵\n\nSeu pedido #${order.id.slice(0,8)} acaba de sair para entrega!\n⏱️ Previsão: ${eta} min\n💰 Total: ${fmt(order.total)}\n\nObrigado pela preferência!`;
  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Despachar pedido</div>
          <h2 className="text-lg font-extrabold">#{order.id.slice(0,8)} · {order.customer_name??"Cliente"}</h2>
        </div>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tempo estimado de entrega</label>
        <div className="flex gap-2 flex-wrap">
          {[15,20,30,45,60].map(m=>(
            <button key={m} onClick={()=>setEta(m)}
              className={cn("h-10 px-4 rounded-xl text-sm font-bold border transition-colors",eta===m?"gradient-brand text-primary-foreground border-transparent shadow-brand":"border-border hover:bg-muted")}>
              {m} min
            </button>
          ))}
        </div>
      </div>
      <label className={cn("flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors",sendWa&&hasPhone?"border-green-500/40 bg-green-500/5":"border-border",!hasPhone&&"opacity-50 cursor-not-allowed")}>
        <input type="checkbox" checked={sendWa&&hasPhone} disabled={!hasPhone} onChange={e=>setSendWa(e.target.checked)} className="mt-1 h-4 w-4 accent-green-600"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold"><MessageCircle className="h-4 w-4 text-green-600"/>Avisar cliente no WhatsApp</div>
          <p className="text-xs text-muted-foreground mt-0.5">{hasPhone?"Abre o WhatsApp com a mensagem pronta para enviar.":"Cliente sem telefone cadastrado."}</p>
          {sendWa&&hasPhone&&(
            <pre className="mt-2 text-[11px] bg-muted/50 rounded-lg p-2 whitespace-pre-wrap font-sans text-foreground">{preview}</pre>
          )}
        </div>
      </label>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={()=>onConfirm(eta,sendWa&&hasPhone)}
          className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2">
          <Bike className="h-4 w-4"/>Despachar
        </button>
      </div>
    </motion.div>
  </>);
}

/* ── Main ── */
function DeliveryPage(){
  const {restaurant}=useAuth();
  const [orders,setOrders]=useState<DeliveryOrder[]>([]);
  const [loading,setLoading]=useState(true);
  const [newModal,setNewModal]=useState(false);
  const [dispatchOrder,setDispatchOrder]=useState<DeliveryOrder|null>(null);

  const load=useCallback(async()=>{
    if(!restaurant)return;
    const today=new Date();today.setHours(0,0,0,0);
    const{data}=await supabase.from("orders")
      .select("id,status,total,created_at,notes,customer_name,customer_phone,delivery_address,order_items(id,name_snapshot,quantity,price_snapshot,notes)")
      .eq("restaurant_id",restaurant.id).eq("type","delivery")
      .gte("created_at",today.toISOString()).neq("status","cancelled")
      .order("created_at",{ascending:false});
    setOrders((data??[]).map(o=>({...o,status:o.status as DS,order_items:(o.order_items as OI[])?? []})));
    setLoading(false);
  },[restaurant]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!restaurant)return;
    const ch=supabase.channel(`delivery-rt-${restaurant.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`restaurant_id=eq.${restaurant.id}`},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(ch);};
  },[restaurant,load]);

  const advance=async(id:string,next:DS)=>{
    const{error}=await supabase.from("orders").update({status:next,updated_at:new Date().toISOString()}).eq("id",id);
    if(error)toast.error("Erro ao atualizar");else{toast.success("Status atualizado!");void load();}
  };

  const printOrder=(order:DeliveryOrder)=>{
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><title>Delivery</title><style>*{margin:0;padding:0}body{font-family:monospace;font-size:14px;padding:20px;max-width:300px;margin:auto}h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px}.row{display:flex;justify-content:space-between;margin:5px 0}.sep{border-top:2px dashed #000;margin:10px 0}.total{font-weight:900;font-size:16px}</style></head><body>
    <h2>🛵 DELIVERY</h2>
    <p style="margin-bottom:8px"><strong>${order.customer_name??""}</strong><br>${order.customer_phone??""}<br>${order.delivery_address??""}</p>
    ${order.order_items.map(i=>`<div class="row"><span>${i.quantity}× ${i.name_snapshot}</span><span>${fmt(i.price_snapshot*i.quantity)}</span></div>`).join("")}
    ${order.notes?`<p style="background:#f5f5f5;padding:6px 10px;font-size:12px;margin:8px 0">📝 ${order.notes}</p>`:""}
    <div class="sep"></div><div class="row total"><span>TOTAL</span><span>${fmt(order.total)}</span></div>
    <div style="text-align:center;color:#999;font-size:11px;margin-top:8px">#${order.id.slice(0,8)} · ${new Date().toLocaleTimeString("pt-BR")}</div>
    </body></html>`);
    w.document.close();w.print();
  };

  const todayRevenue=orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.total,0);
  const inRoute=orders.filter(o=>o.status==="out_for_delivery").length;

  return(
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2"><Bike className="h-7 w-7 text-primary"/>Delivery</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{fmt(todayRevenue)} entregues hoje · {inRoute} em rota</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground"><RefreshCw className="h-4 w-4"/></button>
            <button onClick={()=>setNewModal(true)}
              className="flex h-10 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform">
              <Plus className="h-4 w-4"/>Novo pedido
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        {loading?(
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
        ):orders.length===0?(
          <div className="grid place-items-center py-20 text-center">
            <Package className="h-12 w-12 text-muted-foreground/30 mb-4"/>
            <p className="text-sm text-muted-foreground mb-3">Nenhum pedido de delivery hoje.</p>
            <button onClick={()=>setNewModal(true)} className="h-9 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand">Criar primeiro pedido</button>
          </div>
        ):(
          <div className="flex gap-4 min-w-max h-full">
            {COLS.map(col=>{
              const items=orders.filter(o=>o.status===col.key);
              return(
                <div key={col.key} className="w-72 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn("h-2.5 w-2.5 rounded-full",col.dot)}/><span className="text-sm font-black">{col.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-black text-muted-foreground">{items.length}</span>
                  </div>
                  <div className={cn("flex-1 rounded-2xl border-2 p-3 space-y-3 min-h-[300px]",col.ring)}>
                    <AnimatePresence mode="popLayout">
                      {items.length===0&&<motion.div initial={{opacity:0}} animate={{opacity:0.4}} className="grid place-items-center py-12 text-xs text-muted-foreground">Nada aqui</motion.div>}
                      {items.map(o=><DeliveryCard key={o.id} order={o} onAdvance={advance} onPrint={printOrder}/>)}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {newModal&&restaurant&&<NewModal restaurantId={restaurant.id} onClose={()=>setNewModal(false)} onSaved={load}/>}
      </AnimatePresence>
    </div>
  );
}
