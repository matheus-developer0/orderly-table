import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Plus, Download, Loader2, Trash2, QrCode as QrIcon,
  CheckCircle2, AlertTriangle, RefreshCw, Printer,
  X, Check, Pencil, Link2, Utensils, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/mesas")({ component: MesasPage });

type TS="free"|"occupied"|"bill_requested";
type Table={id:string;number:number;qr_code:string;status:TS;order_total?:number;order_count?:number;occupied_since?:string|null;customer_names?:string[]};

const SM:Record<TS,{label:string;color:string;dot:string}> = {
  free:           {label:"Livre",       color:"bg-success/10 text-success border-success/20",          dot:"bg-success"},
  occupied:       {label:"Ocupada",     color:"bg-blue-500/10 text-blue-600 border-blue-500/20",       dot:"bg-blue-500"},
  bill_requested: {label:"Conta pedida",color:"bg-amber-500/10 text-amber-600 border-amber-500/20",    dot:"bg-amber-500"},
};

const fmt=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function ago(d:string){const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}min`;return`${Math.floor(s/3600)}h`;}

/* ── Edit Modal ── */
function EditModal({table,onClose,onSaved}:{table:Table;onClose:()=>void;onSaved:()=>void}){
  const [num,setNum]=useState(String(table.number));
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    const n=parseInt(num);
    if(isNaN(n)||n<1)return toast.error("Número inválido");
    setSaving(true);
    const{error}=await supabase.from("tables").update({number:n}).eq("id",table.id);
    setSaving(false);
    if(error)return toast.error(error.message);
    toast.success("Mesa atualizada");onSaved();onClose();
  };
  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">Editar Mesa {table.number}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button></div>
      <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número</label>
        <input type="number" min={1} autoFocus value={num} onChange={e=>setNum(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void save()} className="input-base text-2xl font-black"/></div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancelar</button>
        <button onClick={()=>void save()} disabled={saving} className="flex-1 h-11 rounded-xl gradient-brand text-sm font-bold text-primary-foreground shadow-brand flex items-center justify-center gap-2 disabled:opacity-60">
          {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<><Check className="h-4 w-4"/>Salvar</>}</button>
      </div>
    </motion.div>
  </>);
}

/* ── QR Modal ── */
function QRModal({table,qrUrl,onClose}:{table:Table;qrUrl:string;onClose:()=>void}){
  const mesaUrl=`${window.location.origin}/mesa/${table.id}`;
  const download=()=>{const a=document.createElement("a");a.href=qrUrl;a.download=`mesa-${table.number}.png`;a.click();};
  const copyLink=()=>{void navigator.clipboard.writeText(mesaUrl);toast.success("Link copiado!");};
  const print=()=>{
    const w=window.open("","_blank");if(!w)return;
    w.document.write(`<html><head><title>Mesa ${table.number}</title><style>*{margin:0;padding:0}body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;gap:16px;padding:20px}img{width:280px;height:280px}h1{font-size:32px;font-weight:900}p{color:#666;font-size:14px;text-align:center}.url{font-size:11px;color:#aaa;max-width:280px;word-break:break-all;text-align:center}</style></head><body>
    <img src="${qrUrl}"/><h1>Mesa ${table.number}</h1><p>Escaneie para ver o cardápio e fazer pedidos</p><div class="url">${mesaUrl}</div></body></html>`);
    w.document.close();w.print();
  };
  return(<>
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"/>
    <motion.div initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.96}}
      className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl text-center space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Mesa {table.number}</h2>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-muted text-muted-foreground"><X className="h-5 w-5"/></button>
      </div>
      <div className="rounded-2xl bg-white p-4 mx-auto w-fit border border-border/30 shadow-sm">
        <img src={qrUrl} alt={`QR Mesa ${table.number}`} className="h-52 w-52"/>
      </div>
      <div className="rounded-lg bg-muted px-3 py-1.5 text-[11px] text-muted-foreground font-mono truncate">{mesaUrl}</div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={copyLink} className="flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-semibold hover:bg-muted transition-colors">
          <Link2 className="h-4 w-4"/>Copiar link
        </button>
        <button onClick={print} className="flex flex-col items-center gap-1.5 rounded-xl border border-border py-3 text-xs font-semibold hover:bg-muted transition-colors">
          <Printer className="h-4 w-4"/>Imprimir
        </button>
        <button onClick={download} className="flex flex-col items-center gap-1.5 rounded-xl gradient-brand text-xs font-bold text-primary-foreground shadow-brand">
          <Download className="h-4 w-4"/>Baixar
        </button>
      </div>
    </motion.div>
  </>);
}

/* ── Main ── */
function MesasPage(){
  const {restaurant}=useAuth();
  const [tables,setTables]=useState<Table[]>([]);
  const [qrs,setQrs]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [addCount,setAddCount]=useState(1);
  const [adding,setAdding]=useState(false);
  const [editModal,setEditModal]=useState<Table|null>(null);
  const [qrModal,setQrModal]=useState<Table|null>(null);
  const [filterStatus,setFilter]=useState<"all"|TS>("all");

  const load=useCallback(async()=>{
    if(!restaurant)return;
    const{data}=await supabase.from("tables").select("id,number,qr_code,status").eq("restaurant_id",restaurant.id).order("number");
    const list=(data??[]) as Table[];
    const occupiedIds=list.filter(t=>t.status!=="free").map(t=>t.id);
    let orderMap:Record<string,{total:number;count:number;since:string;names:string[]}> = {};
    if(occupiedIds.length){
      const{data:orders}=await supabase.from("orders").select("table_id,total,created_at,suborders(customer_name)")
        .in("table_id",occupiedIds).in("status",["new","preparing","ready"]).order("created_at");
      for(const o of orders??[]){
        if(!o.table_id)continue;
        if(!orderMap[o.table_id])orderMap[o.table_id]={total:0,count:0,since:o.created_at,names:[]};
        orderMap[o.table_id].total+=Number(o.total);
        orderMap[o.table_id].count+=1;
        const names=(o.suborders as {customer_name:string}[]??[]).map(s=>s.customer_name);
        for(const n of names)if(!orderMap[o.table_id].names.includes(n))orderMap[o.table_id].names.push(n);
      }
    }
    const enriched:Table[]=list.map(t=>({...t,order_total:orderMap[t.id]?.total,order_count:orderMap[t.id]?.count,occupied_since:orderMap[t.id]?.since??null,customer_names:orderMap[t.id]?.names??[]}));
    setTables(enriched);
    setLoading(false);
    const missing=enriched.filter(t=>!qrs[t.id]);
    if(missing.length){
      const entries=await Promise.all(missing.map(async t=>{
        const url=`${window.location.origin}/mesa/${t.id}`;
        const png=await QRCode.toDataURL(url,{margin:1,width:260,color:{dark:"#1a1a1a",light:"#ffffff"}});
        return[t.id,png] as[string,string];
      }));
      setQrs(prev=>({...prev,...Object.fromEntries(entries)}));
    }
  },[restaurant]);// eslint-disable-line

  useEffect(()=>{void load();},[restaurant]);
  useEffect(()=>{
    if(!restaurant)return;
    const ch=supabase.channel(`tables-rt-${restaurant.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"tables",filter:`restaurant_id=eq.${restaurant.id}`},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`restaurant_id=eq.${restaurant.id}`},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(ch);};
  },[restaurant,load]);

  const addTables=async()=>{
    if(!restaurant)return;setAdding(true);
    const lastNum=tables.at(-1)?.number??0;
    const rows=Array.from({length:addCount},(_,i)=>({restaurant_id:restaurant.id,number:lastNum+i+1,qr_code:`${restaurant.slug}-mesa-${lastNum+i+1}`}));
    const{error}=await supabase.from("tables").insert(rows);
    setAdding(false);
    if(error)return toast.error(error.message);
    toast.success(`${addCount} mesa${addCount>1?"s":""} criada${addCount>1?"s":""}!`);
    void load();
  };
  const deleteTable=async(t:Table)=>{
    if(t.status!=="free")return toast.error("Só é possível excluir mesas livres.");
    if(!confirm(`Excluir Mesa ${t.number}?`))return;
    await supabase.from("tables").delete().eq("id",t.id);
    toast.success(`Mesa ${t.number} excluída`);void load();
  };
  const freeTable=async(t:Table)=>{
    await supabase.from("tables").update({status:"free"}).eq("id",t.id);
    toast.success(`Mesa ${t.number} liberada`);void load();
  };

  const filtered=filterStatus==="all"?tables:tables.filter(t=>t.status===filterStatus);
  const counts={all:tables.length,free:tables.filter(t=>t.status==="free").length,occupied:tables.filter(t=>t.status==="occupied").length,bill_requested:tables.filter(t=>t.status==="bill_requested").length};
  const totalRevenue=tables.filter(t=>t.status!=="free").reduce((s,t)=>s+(t.order_total??0),0);

  return(
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 space-y-4 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operação</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Mesas & QR Codes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{tables.length} mesas · {counts.occupied} ocupadas · {fmt(totalRevenue)} em aberto</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground"><RefreshCw className="h-4 w-4"/></button>
            <select value={addCount} onChange={e=>setAddCount(Number(e.target.value))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none cursor-pointer">
              {[1,2,3,4,5,10].map(n=><option key={n} value={n}>{n} mesa{n>1?"s":""}</option>)}
            </select>
            <button onClick={()=>void addTables()} disabled={adding}
              className="flex h-10 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform disabled:opacity-60">
              {adding?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Adicionar
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([["all","Todas"],["free","Livres"],["occupied","Ocupadas"],["bill_requested","Conta pedida"]] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",filterStatus===k?"gradient-brand text-primary-foreground border-transparent shadow-brand":"border-border text-muted-foreground hover:bg-muted")}>
              {k!=="all"&&<span className={cn("h-1.5 w-1.5 rounded-full",SM[k as TS].dot)}/>}
              {l}<span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold",filterStatus===k?"bg-white/20":"bg-muted")}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading?(
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(8)].map((_,i)=><div key={i} className="h-72 rounded-2xl bg-muted animate-pulse"/>)}
          </div>
        ):filtered.length===0?(
          <div className="grid place-items-center py-24 text-center">
            <QrIcon className="h-12 w-12 text-muted-foreground/30 mb-4"/>
            <p className="text-sm text-muted-foreground">{tables.length===0?"Nenhuma mesa criada.":"Nenhuma mesa com este status."}</p>
          </div>
        ):(
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence mode="popLayout">
              {filtered.map((t,i)=>{
                const meta=SM[t.status];
                return(
                  <motion.div key={t.id} layout initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.9}} transition={{delay:Math.min(i,10)*0.02}}
                    className={cn("rounded-2xl border bg-card shadow-card flex flex-col overflow-hidden",t.status==="bill_requested"&&"border-amber-500/30 ring-1 ring-amber-500/20",t.status==="occupied"&&"border-blue-500/20")}>
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mesa</div>
                          <div className="text-3xl font-black tracking-tight">{t.number}</div>
                        </div>
                        <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",meta.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",meta.dot)}/>{meta.label}
                        </span>
                      </div>
                      {t.status!=="free"&&(
                        <div className="mt-2 space-y-0.5">
                          {t.order_total&&t.order_total>0&&<div className="text-sm font-extrabold text-primary flex items-center gap-1"><DollarSign className="h-3.5 w-3.5"/>{fmt(t.order_total)}</div>}
                          {t.occupied_since&&<div className="text-[11px] text-muted-foreground">{ago(t.occupied_since)} · {t.order_count??0} pedido{(t.order_count??0)!==1?"s":""}</div>}
                          {(t.customer_names?.length??0)>0&&<div className="text-[10px] text-muted-foreground truncate">👤 {t.customer_names!.join(", ")}</div>}
                        </div>
                      )}
                    </div>
                    <button className="mx-3 mb-2 rounded-xl bg-white p-2 border border-border/30 cursor-pointer hover:opacity-80 transition-opacity" onClick={()=>qrs[t.id]&&setQrModal(t)}>
                      {qrs[t.id]?<img src={qrs[t.id]} alt={`QR ${t.number}`} className="h-28 w-full object-contain"/>
                        :<div className="h-28 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></div>}
                    </button>
                    <div className="mt-auto grid grid-cols-3 border-t border-border divide-x divide-border">
                      <button onClick={()=>setEditModal(t)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5"/>Editar
                      </button>
                      {t.status!=="free"
                        ?<button onClick={()=>void freeTable(t)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-success/10 hover:text-success transition-colors">
                            <CheckCircle2 className="h-3.5 w-3.5"/>Liberar
                          </button>
                        :<button onClick={()=>qrs[t.id]&&setQrModal(t)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors">
                            <QrIcon className="h-3.5 w-3.5"/>Ver QR
                          </button>}
                      <button onClick={()=>void deleteTable(t)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5"/>Excluir
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editModal&&<EditModal table={editModal} onClose={()=>setEditModal(null)} onSaved={load}/>}
        {qrModal&&qrs[qrModal.id]&&<QRModal table={qrModal} qrUrl={qrs[qrModal.id]} onClose={()=>setQrModal(null)}/>}
      </AnimatePresence>
    </div>
  );
}

void AlertTriangle; void Utensils;
