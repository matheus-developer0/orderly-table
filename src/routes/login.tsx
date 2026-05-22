import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/admin" });
  }, [session, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Brand side */}
        <div className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative">
            <BrandLogo className="[&_span]:text-sidebar-foreground" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative space-y-6"
          >
            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-sidebar-foreground">
              O sistema operacional do{" "}
              <span className="text-primary">seu restaurante.</span>
            </h1>
            <p className="max-w-md text-base text-sidebar-foreground/70">
              Cardápio digital, pedidos em tempo real, cozinha kanban, controle de
              mesas e gestão completa. Tudo em um só lugar.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              {["QR Code", "Realtime", "PWA", "Multi-tenant"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
          <div className="relative text-xs text-sidebar-foreground/40">
            © 2026 Mesa.io — Restaurant OS
          </div>
        </div>

        {/* Form side */}
        <div className="flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8"
          >
            <div className="lg:hidden">
              <BrandLogo />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Entrar</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Acesse o painel do seu restaurante.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                icon={<Mail className="h-4 w-4" />}
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                icon={<Lock className="h-4 w-4" />}
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={busy}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand transition-all hover:scale-[1.01] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link
                to="/signup"
                className="font-semibold text-primary hover:underline"
              >
                Criar restaurante
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </div>
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
    </div>
  );
}
