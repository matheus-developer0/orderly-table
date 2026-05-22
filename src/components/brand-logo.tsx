import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-brand">
        <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-extrabold tracking-tight text-foreground">
            Mesa<span className="text-primary">.</span>io
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Restaurant OS
          </span>
        </div>
      )}
    </div>
  );
}
