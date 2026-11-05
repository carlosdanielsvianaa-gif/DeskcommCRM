"use client";

import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";
import { MARCOS_DA_JORNADA, posicaoNaJornada } from "@/lib/solar/jornada";

/**
 * A faixa "Jornada do cliente" do dossiê: Proposta → Contrato → Financeiro →
 * Engenharia e Homologação → Instalação → Gerando Energia. Marco concluído em
 * verde, o atual destacado, o resto apagado. Some quando a etapa não é de um
 * funil solar (`posicaoNaJornada` devolve `null`).
 */
export function JornadaDoCliente({ slugDaEtapa }: { slugDaEtapa: string | null | undefined }) {
  const t = useT();
  const posicao = posicaoNaJornada(slugDaEtapa);
  if (!posicao) return null;
  return (
    <section aria-label={t("Jornada do cliente")} data-testid="jornada-do-cliente" className="border-b border-border py-3">
      <p className="mb-2 text-xs font-medium text-text-muted">{t("Jornada do cliente")}</p>
      <ol className="grid grid-cols-6 gap-1">
        {MARCOS_DA_JORNADA.map((marco, i) => {
          const feito = posicao.concluida || i < posicao.atual;
          const atual = !posicao.concluida && i === posicao.atual;
          const estado = feito ? "feito" : atual ? (posicao.interrompida ? "interrompido" : "atual") : "pendente";
          return (
            <li key={marco} data-estado={estado} className="flex min-w-0 flex-col items-center gap-1 text-center">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-full rounded-full",
                  estado === "feito" && "bg-success",
                  estado === "atual" && "bg-info",
                  estado === "interrompido" && "bg-error",
                  estado === "pendente" && "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  estado === "pendente" ? "text-text-muted" : "font-medium text-text",
                )}
              >
                {t(marco)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
