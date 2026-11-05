"use client";

import type { Lead } from "@/lib/types/leads";
import { MapPin, Sun } from "@/lib/ui/icons";

interface Props {
  lead: Pick<Lead, "custom_fields">;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor.toLocaleString("pt-BR");
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  return null;
}

/**
 * A linha do negócio solar no card do funil: consumo e cidade/UF, lidos dos
 * campos que os funis prontos de energia solar declaram (`lib/solar/funis.ts`).
 *
 * Some por inteiro quando o negócio não tem nenhum dos dois — o card de um
 * funil que não é solar fica exatamente como era.
 */
export function SolarNoCard({ lead }: Props) {
  const campos = lead.custom_fields ?? {};
  const consumo = texto(campos.consumo_kwh);
  const cidade = texto(campos.cidade);
  const uf = texto(campos.uf);
  const local = cidade && uf ? `${cidade}/${uf}` : (cidade ?? uf);
  if (!consumo && !local) return null;
  return (
    <p data-testid="card-solar" className="mt-1 flex min-w-0 items-center gap-3 text-xs text-text-muted">
      {consumo ? (
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          <Sun className="h-3.5 w-3.5" aria-hidden />
          {consumo} kWh
        </span>
      ) : null}
      {local ? (
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{local}</span>
        </span>
      ) : null}
    </p>
  );
}
