import { z } from "zod";

/**
 * O CONTRATO DA CALCULADORA SOLAR — um só, lido pela tela E pela rota de
 * propostas (padrão `lib/schemas/propostas.ts`). Os limites recusam o número
 * que não descreve sistema nenhum (consumo negativo, rendimento de 300%) antes
 * de ele virar texto num PDF que vai para o cliente.
 */
export const entradaSolarSchema = z.object({
  consumo_medio_kwh: z.number().positive().max(1_000_000),
  tipo_ligacao: z.enum(["monofasica", "bifasica", "trifasica"]),
  uf: z.string().trim().length(2).toUpperCase(),
  cidade: z.string().trim().max(120).default(""),
  hsp: z.number().min(1).max(8),
  potencia_modulo_w: z.number().int().min(100).max(1000),
  area_modulo_m2: z.number().positive().max(5),
  rendimento_pct: z.number().min(50).max(100),
  tarifa_kwh: z.number().positive().max(10),
  fio_b_kwh: z.number().min(0).max(5),
  simultaneidade_pct: z.number().min(0).max(100),
  ano_inicio: z.number().int().min(2023).max(2100),
  preco_por_wp: z.number().positive().max(50),
  reajuste_tarifa_pct_ano: z.number().min(0).max(30),
  degradacao_pct_ano: z.number().min(0).max(5),
  anos_analise: z.number().int().min(1).max(30),
  marca_modulo: z.string().trim().max(120).default(""),
  marca_inversor: z.string().trim().max(120).default(""),
  tipo_telhado: z.string().trim().max(120).default(""),
  concessionaria: z.string().trim().max(120).default(""),
});

export type EntradaSolarValidada = z.infer<typeof entradaSolarSchema>;
