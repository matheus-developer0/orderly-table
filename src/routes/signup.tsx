import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        data: { name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email para confirmar.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
          <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
          <BrandLogo className="relative [&_span]:text-sidebar-foreground" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative space-y-6"
          >
            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-sidebar-foreground">
              Comece em <span className="text-primary">3 minutos.</span>
            </h1>
            <p className="max-w-md text-base text-sidebar-foreground/70">
              Crie sua conta, configure seu restaurante e comece a receber pedidos
              pelo QR Code hoje mesmo.
            </p>
          </motion.div>
          <div className="relative text-xs text-sidebar-foreground/40">
            © 2026 Mesa.io
          </div>
        </div>

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
              <h2 className="text-3xl font-extrabold tracking-tight">
                Criar restaurante
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Configure tudo no próximo passo.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field
                icon={<User className="h-4 w-4" />}
                placeholder="Seu nome"
                value={name}
                onChange={setName}
              />
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
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={busy || password.length < 6}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl gradient-brand px-4 text-sm font-bold text-primary-foreground shadow-brand transition-all hover:scale-[1.01] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Criar conta
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Entrar
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
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ReactNode;
  type?: string;
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
