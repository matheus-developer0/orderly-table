import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Loader2, Check, Palette, Store, Globe } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({ component: ConfiguracoesPage });

const COLORS = ["#E11D2E","#F97316","#EAB308","#22C55E","#3B82F6","#8B5CF6","#EC4899","#14B8A6","#0EA5E9","#64748B"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ConfiguracoesPage() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [form, setForm] = useState({
    name: "", slug: "", phone: "", address: "", logo_url: "", primary_color: "#E11D2E",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"geral" | "aparencia">("geral");

  useEffect(() => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name ?? "",
      slug: restaurant.slug ?? "",
      phone: restaurant.phone ?? "",
      address: restaurant.address ?? "",
      logo_url: restaurant.logo_url ?? "",
      primary_color: restaurant.primary_color ?? "#E11D2E",
    });
  }, [restaurant]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!restaurant) return;
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (!form.slug.trim()) return toast.error("Slug obrigatório");
    setSaving(true);
    const { error } = await supabase.from("restaurants").update({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      phone: form.phone || null,
      address: form.address || null,
      logo_url: form.logo_url || null,
      primary_color: form.primary_color,
    }).eq("id", restaurant.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshRestaurant();
    toast.success("Configurações salvas!");
  };

  const menuUrl = form.slug ? `${window.location.origin}/mesa/[id]` : "";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sistema</div>
            <h1 className="text-3xl font-extrabold tracking-tight">Configurações</h1>
          </div>
          <button onClick={() => void save()} disabled={saving}
            className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-5 text-sm font-bold text-primary-foreground shadow-brand hover:scale-[1.02] transition-transform disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar alterações</>}
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit mt-4">
          {([["geral", "Geral", Store], ["aparencia", "Aparência", Palette]] as const).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-6">
          {tab === "geral" ? (
            <motion.div key="geral" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-4">
                <h2 className="font-bold flex items-center gap-2"><Store className="h-4 w-4" />Informações do restaurante</h2>
                <Field label="Nome do restaurante *">
                  <input value={form.name} onChange={e => set("name", e.target.value)} className="input-base" placeholder="Pizzaria do João" />
                </Field>
                <Field label="Slug (URL)" hint={`Usado no link do cardápio. Apenas letras, números e hífens.`}>
                  <div className="flex rounded-xl border border-input overflow-hidden focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                    <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground border-r border-input shrink-0">zest-dine.lovable.app/</span>
                    <input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="flex-1 h-10 bg-background px-3 text-sm outline-none" placeholder="pizzaria-joao" />
                  </div>
                </Field>
                <Field label="Telefone / WhatsApp">
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} className="input-base" placeholder="(11) 99999-9999" />
                </Field>
                <Field label="Endereço">
                  <input value={form.address} onChange={e => set("address", e.target.value)} className="input-base" placeholder="Rua Exemplo, 123 - Bairro - Cidade" />
                </Field>
              </div>

              {menuUrl && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
                  <h2 className="font-bold flex items-center gap-2"><Globe className="h-4 w-4" />Link do cardápio digital</h2>
                  <div className="rounded-xl bg-muted px-4 py-3 font-mono text-sm break-all">{menuUrl}</div>
                  <p className="text-xs text-muted-foreground">Substitua [id] pelo ID da mesa para gerar o QR Code em Mesas & QR.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="aparencia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
                <h2 className="font-bold flex items-center gap-2"><Palette className="h-4 w-4" />Identidade visual</h2>
                <Field label="URL do logotipo" hint="Recomendado: PNG ou SVG com fundo transparente, mínimo 200×200px">
                  <input value={form.logo_url} onChange={e => set("logo_url", e.target.value)} className="input-base" placeholder="https://..." />
                  {form.logo_url && (
                    <div className="mt-2 flex items-center gap-4">
                      <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-xl object-contain border border-border bg-muted p-1" onError={e => { e.currentTarget.style.display = "none"; }} />
                      <div className="text-xs text-muted-foreground">Preview do logo</div>
                    </div>
                  )}
                </Field>

                <Field label="Cor principal" hint="Usada nos botões, cabeçalho do cardápio e destaque do sistema">
                  <div className="space-y-3">
                    {/* Preset colors */}
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => set("primary_color", c)}
                          className={cn("h-8 w-8 rounded-lg border-2 transition-all hover:scale-110", form.primary_color === c ? "border-foreground scale-110" : "border-transparent")}
                          style={{ background: c }} title={c} />
                      ))}
                    </div>
                    {/* Custom color */}
                    <div className="flex items-center gap-3">
                      <input type="color" value={form.primary_color} onChange={e => set("primary_color", e.target.value)} className="h-10 w-16 rounded-xl border border-border cursor-pointer bg-transparent" />
                      <input value={form.primary_color} onChange={e => set("primary_color", e.target.value)} className="input-base font-mono uppercase flex-1" placeholder="#E11D2E" maxLength={7} />
                    </div>
                  </div>
                </Field>

                {/* Live preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${form.primary_color}, #111)` }}>
                    {form.name || "Seu restaurante"} — Preview do header
                  </div>
                  <div className="p-4 bg-muted/30 flex items-center gap-3">
                    <button className="rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm" style={{ background: form.primary_color }}>Botão primário</button>
                    <button className="rounded-xl border-2 px-4 py-2 text-sm font-bold" style={{ borderColor: form.primary_color, color: form.primary_color }}>Botão outline</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
