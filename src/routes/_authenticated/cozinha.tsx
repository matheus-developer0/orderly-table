import { createFileRoute } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cozinha")({
  component: CozinhaPage,
});

function CozinhaPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand shadow-brand">
          <ChefHat className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
          Painel da Cozinha
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kanban em tempo real (Novo → Preparo → Pronto → Saiu → Cancelado) com som,
          drag-and-drop e modal de cancelamento. Disponível na Fase 3.
        </p>
      </div>
    </div>
  );
}
