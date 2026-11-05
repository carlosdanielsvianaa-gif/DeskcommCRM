"use client";

import { useT } from "@/hooks/i18n/useT";
import type { TotaisDoFunil as Totais, TotalDoFunil } from "@/lib/kanban/totais-do-funil";
import { formatarMoeda } from "@/lib/propostas/moeda";

/**
 * A faixa do topo do funil: Propostas, Aceitas e Vendas, com quantidade e R$.
 * Some quando a leitura falhou (`totais` nulo) — o quadro abre igual.
 */
export function TotaisDoFunil({ totais }: { totais: Totais | null }) {
  const t = useT();
  if (!totais) return null;
  const blocos: Array<{ id: string; rotulo: string; total: TotalDoFunil; destaque?: boolean }> = [
    { id: "propostas", rotulo: t("Propostas"), total: totais.propostas },
    { id: "aceitas", rotulo: t("Aceitas"), total: totais.aceitas },
    { id: "vendas", rotulo: t("Vendas"), total: totais.vendas, destaque: true },
  ];
  return (
    <section
      aria-label={t("Totais do funil")}
      data-testid="totais-do-funil"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      {blocos.map((b) => (
        <div
          key={b.id}
          data-testid={`total-${b.id}`}
          className={
            b.destaque
              ? "rounded-md border border-success/40 bg-success-bg px-3 py-2"
              : "rounded-md border border-border bg-surface-elevated/40 px-3 py-2"
          }
        >
          <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{b.rotulo}</p>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-semibold tabular-nums">{b.total.quantidade.toLocaleString("pt-BR")}</span>
            <span className="truncate text-sm font-medium tabular-nums">
              {formatarMoeda(b.total.valor_cents, "BRL")}
            </span>
          </p>
        </div>
      ))}
    </section>
  );
}
