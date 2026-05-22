import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: EquipePage,
});

function EquipePage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-10">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/40">
          <Users className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-tight">Equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Convide garçons, cozinheiros, caixas e gerentes com permissões específicas.
          Disponível na Fase 3.
        </p>
      </div>
    </div>
  );
}
