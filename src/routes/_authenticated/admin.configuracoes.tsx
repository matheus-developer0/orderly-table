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

type Toggles = Record<string, boolean>;

type Settings = {
  notif?: Toggles;
  print?: Record<string, boolean | string | undefined>;
  payment?: Toggles;
};

const DEFAULT_NOTIF: Toggles = {
  sound_new_order: true,
  push_waiter_call: true,
  daily_email_summary: false,
  stuck_table_alert: true,
};
const DEFAULT_PRINT: Toggles = { auto_print_new_orders: true, customer_receipt: true };
const DEFAULT_PAYMENT: Toggles = { pix: true, credit: true, debit: true, cash: true, voucher: false };

const NOTIF_LABELS: Record<string, { label: string; desc: string }> = {
  sound_new_order: { label: "Som em novos pedidos", desc: "Toca um som ao receber pedido na cozinha" },
  push_waiter_call: { label: "Push no chamado de garçom", desc: "Notificação imediata para garçons" },
  daily_email_summary: { label: "Resumo diário por e-mail", desc: "Receba o fechamento do dia às 23h59" },
  stuck_table_alert: { label: "Alerta de mesa parada > 30min", desc: "Lembrete pra cobrar atenção" },
};
const PRINT_LABELS: Record<string, { label: string; desc: string }> = {
  auto_print_new_orders: { label: "Imprimir automaticamente novos pedidos", desc: "Cozinha + bar" },
  customer_receipt: { label: "Cupom para cliente ao fechar conta", desc: "Não-fiscal" },
};
const PAYMENT_LABELS: Record<string, { label: string; desc: string }> = {
  pix:     { label: "Pix",                 desc: "Receba via QR Code instantâneo" },
  credit:  { label: "Cartão de crédito",   desc: "Visa, Master, Elo, Hipercard" },
  debit:   { label: "Cartão de débito",    desc: "Maquininha integrada" },
  cash:    { label: "Dinheiro",            desc: "Receba na hora da entrega" },
  voucher: { label: "Vale-refeição",       desc: "Sodexo, Ticket, Alelo" },
};

function ConfigPage() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [primary, setPrimary] = useState("#E11D2E");
  const [accent, setAccent] = useState("#FFC93C");
  const [printerName, setPrinterName] = useState("Bematech MP-4200 TH");
  const [paperWidth, setPaperWidth] = useState("80mm");
  const [notif, setNotif] = useState<Toggles>(DEFAULT_NOTIF);
  const [print, setPrint] = useState<Toggles>(DEFAULT_PRINT);
  const [payment, setPayment] = useState<Toggles>(DEFAULT_PAYMENT);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"loja" | "marca" | "notif" | "impressao" | "pagto">("loja");

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setPrimary(restaurant.primary_color ?? "#E11D2E");
    setAccent(restaurant.accent_color ?? "#FFC93C");
    void (async () => {
      const { data } = await supabase.from("restaurants").select("phone,address,settings").eq("id", restaurant.id).maybeSingle();
      setPhone(data?.phone ?? "");
      setAddress(data?.address ?? "");
      const s = (data?.settings ?? {}) as Settings;
      setNotif({ ...DEFAULT_NOTIF, ...(s.notif ?? {}) });
      const rawPrint = (s.print ?? {}) as Record<string, unknown>;
      const printToggles: Toggles = { ...DEFAULT_PRINT };
      for (const k of Object.keys(DEFAULT_PRINT)) {
        if (typeof rawPrint[k] === "boolean") printToggles[k] = rawPrint[k] as boolean;
      }
      setPrint(printToggles);
      if (typeof rawPrint.printer_name === "string") setPrinterName(rawPrint.printer_name);
      if (typeof rawPrint.paper_width === "string") setPaperWidth(rawPrint.paper_width);
      setPayment({ ...DEFAULT_PAYMENT, ...(s.payment ?? {}) });
    })();
  }, [restaurant]);

  const save = async () => {
    if (!restaurant) return;
    setSaving(true);
    const settings: Settings = {
      notif,
      print: { ...print, printer_name: printerName, paper_width: paperWidth },
      payment,
    };
    const { error } = await supabase
      .from("restaurants")
      .update({ name, phone, address, primary_color: primary, accent_color: accent, settings })
      .eq("id", restaurant.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Configurações salvas!"); await refreshRestaurant(); }
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
            <ColorRow label="Cor primária" value={primary} onChange={setPrimary} />
            <ColorRow label="Cor de destaque" value={accent} onChange={setAccent} />
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
            {Object.entries(NOTIF_LABELS).map(([k, m]) => (
              <ToggleRow key={k} label={m.label} desc={m.desc}
                on={!!notif[k]} onChange={(v) => setNotif({ ...notif, [k]: v })} />
            ))}
          </div>
        )}

        {tab === "impressao" && (
          <div className="space-y-3">
            <Field label="Nome da impressora" value={printerName} onChange={setPrinterName} />
            <Field label="Largura do papel" value={paperWidth} onChange={setPaperWidth} placeholder="58mm ou 80mm" />
            {Object.entries(PRINT_LABELS).map(([k, m]) => (
              <ToggleRow key={k} label={m.label} desc={m.desc}
                on={!!print[k]} onChange={(v) => setPrint({ ...print, [k]: v })} />
            ))}
            <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <strong>Dica:</strong> impressoras USB/Bluetooth exigem um agente desktop. Em breve disponível.
            </div>
          </div>
        )}

        {tab === "pagto" && (
          <div className="space-y-3">
            {Object.entries(PAYMENT_LABELS).map(([k, m]) => (
              <ToggleRow key={k} label={m.label} desc={m.desc}
                on={!!payment[k]} onChange={(v) => setPayment({ ...payment, [k]: v })} />
            ))}
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

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-2 flex items-center gap-3">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-20 rounded-lg cursor-pointer border border-border" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm font-mono outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4">
      <div>
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <button onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
