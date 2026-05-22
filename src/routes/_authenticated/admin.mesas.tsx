import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { Plus, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/mesas")({
  component: MesasPage,
});

type Table = {
  id: string;
  number: number;
  qr_code: string;
  status: string;
};

function MesasPage() {
  const { restaurant } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("tables")
      .select("id,number,qr_code,status")
      .eq("restaurant_id", restaurant.id)
      .order("number");
    setTables(data ?? []);
    setLoading(false);

    // generate QR data urls
    const entries: [string, string][] = await Promise.all(
      (data ?? []).map(async (t) => {
        const url = `${window.location.origin}/mesa/${t.id}`;
        const png = await QRCode.toDataURL(url, {
          margin: 1,
          width: 280,
          color: { dark: "#1a1a1a", light: "#ffffff" },
        });
        return [t.id, png];
      }),
    );
    setQrs(Object.fromEntries(entries));
  };

  useEffect(() => {
    void load();
  }, [restaurant?.id]);

  const addTable = async () => {
    if (!restaurant) return;
    setAdding(true);
    const nextNumber = (tables.at(-1)?.number ?? 0) + 1;
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurant.id,
      number: nextNumber,
      qr_code: `${restaurant.slug}-mesa-${nextNumber}`,
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success(`Mesa ${nextNumber} criada`);
    void load();
  };

  const download = (table: Table, dataUrl: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `mesa-${table.number}.png`;
    a.click();
  };

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Operação
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Mesas & QR Codes</h1>
        </div>
        <button
          onClick={addTable}
          disabled={adding}
          className="flex h-11 items-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Nova mesa
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Mesa
                  </div>
                  <div className="text-3xl font-black tracking-tight">{t.number}</div>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                  {t.status === "free" ? "Livre" : t.status}
                </span>
              </div>
              <div className="mt-3 grid place-items-center rounded-xl bg-muted p-3">
                {qrs[t.id] ? (
                  <img src={qrs[t.id]} alt={`QR Mesa ${t.number}`} className="h-40 w-40" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                )}
              </div>
              <button
                onClick={() => qrs[t.id] && download(t, qrs[t.id])}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-2 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar QR
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
