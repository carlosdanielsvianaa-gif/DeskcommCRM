"use client";

import { useT } from "@/hooks/i18n/useT";
import { MODELOS_DE_FUNIL } from "@/lib/solar/funis";
import type { Lead } from "@/lib/types/leads";
import { FileText, MapPin, Sun } from "@/lib/ui/icons";

interface Props {
  lead: Pick<Lead, "custom_fields" | "propostas">;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor.toLocaleString("pt-BR");
  if (typeof valor === "string" && valor.trim() !== "") return valor.trim();
  return null;
}

/** Valor gravado → rótulo, pelas opções do campo `origem_lead` dos funis solares. */
const ROTULO_DA_ORIGEM = new Map(
  Object.values(MODELOS_DE_FUNIL)
    .flatMap((m) => m.campos)
    .filter((c) => c.key === "origem_lead")
    .flatMap((c) => c.options ?? [])
    .map((o) => [o.value, o.label] as const),
);

export function rotuloDaOrigem(valor: string): string {
  return ROTULO_DA_ORIGEM.get(valor) ?? valor;
}

/**
 * A parte solar do card do funil: origem do negócio, nº de propostas, consumo
 * e cidade/UF — lidos dos campos dos funis prontos de energia solar
 * (`lib/solar/funis.ts`) e do selo de propostas do quadro.
 *
 * Some por inteiro quando o negócio não tem nada disso — o card de um funil
 * que não é solar fica exatamente como era.
 */
export function SolarNoCard({ lead }: Props) {
  const t = useT();
  const campos = lead.custom_fields ?? {};
  const consumo = texto(campos.consumo_kwh);
  const cidade = texto(campos.cidade);
  const uf = texto(campos.uf);
  const local = cidade && uf ? `${cidade}/${uf}` : (cidade ?? uf);
  const origemBruta = texto(campos.origem_lead);
  const origem = origemBruta ? rotuloDaOrigem(origemBruta) : null;
  const propostas = lead.propostas ?? 0;
  if (!consumo && !local && !origem && propostas === 0) return null;
  return (
    <div data-testid="card-solar" className="mt-1 flex min-w-0 flex-col gap-1 text-xs text-text-muted">
      {origem || propostas > 0 ? (
        <p className="flex min-w-0 flex-wrap items-center gap-1.5">
          {origem ? (
            <span
              data-testid="card-origem"
              title={t("Origem")}
              className="max-w-full truncate rounded-full bg-info-bg px-2 py-0.5 font-medium text-info-fg"
            >
              {origem}
            </span>
          ) : null}
          {propostas > 0 ? (
            <span
              data-testid="card-propostas"
              title={t("Propostas")}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 tabular-nums"
            >
              <FileText className="h-3 w-3" aria-hidden />
              {propostas}
            </span>
          ) : null}
        </p>
      ) : null}
      {consumo || local ? (
        <p className="flex min-w-0 items-center gap-3">
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
      ) : null}
    </div>
  );
}
