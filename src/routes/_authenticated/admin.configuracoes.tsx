import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Store, Palette, Bell, Printer, CreditCard, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [primary, setPrimary] = useState("#E11D2E");
  const [accent, setAccent] = useState("#FFC93C");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"loja" | "marca" | "notif" | "impressao" | "pagto">("loja");

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setPrimary(restaurant.primary_color ?? "#E11D2E");
    setAccent(restaurant.accent_color ?? "#FFC93C");
    void (async () => {
      const { data } = await supabase.from("restaurants").select("phone,address").eq("id", restaurant.id).maybeSingle();
      setPhone(data?.phone ?? "");
      setAddress(data?.address ?? "");
    })();
  }, [restaurant]);

  const save = async () => {
    if (!restaurant) return;
    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ name, phone, address, primary_color: primary, accent_color: accent })
      .eq("id", restaurant.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar"); else { toast.success("Configurações salvas!"); await refreshRestaurant(); }
  };

  const TABS = [
    { key: "loja" as const, label: "Loja", icon: Store },
    { key: "marca" as const, label: "Marca", icon: Palette },
    { key: "notif" as const, label: "Notificações", icon: Bell },
    { key: "impressao" as const, label: "Impressão", icon: Printer },
    { key: "pagto" as const, label: "Pagamento", icon: CreditCard },
  ];

  return (
    <div className="space-y-6 p-6 lg:p-10 max-w-4xl">
      <header className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sistema</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize seu restaurante</p>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
        {tab === "loja" && (
          <>
            <Field label="Nome do restaurante" value={name} onChange={setName} />
            <Field label="Telefone (WhatsApp)" value={phone} onChange={setPhone} placeholder="(11) 99999-9999" />
            <Field label="Endereço" value={address} onChange={setAddress} placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF" />
          </>
        )}

        {tab === "marca" && (
          <>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cor primária</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-12 w-20 rounded-lg cursor-pointer border border-border" />
                <input value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cor de destaque</label>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-12 w-20 rounded-lg cursor-pointer border border-border" />
                <input value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Preview</div>
              <div className="rounded-xl p-4 text-white font-bold" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                {name || "Seu restaurante"}
              </div>
            </div>
          </>
        )}

        {tab === "notif" && (
          <div className="space-y-3">
            {[
              { label: "Som em novos pedidos", desc: "Toca um som ao receber pedido na cozinha" },
              { label: "Push no chamado de garçom", desc: "Notificação imediata para garçons" },
              { label: "Resumo diário por e-mail", desc: "Receba o fechamento do dia às 23h59" },
              { label: "Alerta de mesa parada > 30min", desc: "Lembrete pra cobrar atenção" },
            ].map((n) => (
              <ToggleRow key={n.label} {...n} />
            ))}
          </div>
        )}

        {tab === "impressao" && (
          <div className="space-y-3">
            <Field label="Nome da impressora" value="Bematech MP-4200 TH" onChange={() => {}} />
            <Field label="Largura do papel" value="80mm" onChange={() => {}} />
            {[
              { label: "Imprimir automaticamente novos pedidos", desc: "Cozinha + bar" },
              { label: "Cupom para cliente ao fechar conta", desc: "Não-fiscal" },
            ].map((n) => <ToggleRow key={n.label} {...n} />)}
            <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <strong>Dica:</strong> impressoras USB/Bluetooth exigem um agente desktop. Em breve disponível.
            </div>
          </div>
        )}

        {tab === "pagto" && (
          <div className="space-y-3">
            {[
              { label: "Pix", on: true, desc: "Receba via QR Code instantâneo" },
              { label: "Cartão de crédito", on: true, desc: "Visa, Master, Elo, Hipercard" },
              { label: "Cartão de débito", on: true, desc: "Maquininha integrada" },
              { label: "Dinheiro", on: true, desc: "Receba na hora da entrega" },
              { label: "Vale-refeição", on: false, desc: "Sodexo, Ticket, Alelo" },
            ].map((p) => <ToggleRow key={p.label} label={p.label} desc={p.desc} defaultOn={p.on} />)}
          </div>
        )}
      </motion.div>

      <div className="flex justify-end">
        <button onClick={() => void save()} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-brand hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
      />
    </div>
  );
}

function ToggleRow({ label, desc, defaultOn = true }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4">
      <div>
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <button onClick={() => setOn(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
