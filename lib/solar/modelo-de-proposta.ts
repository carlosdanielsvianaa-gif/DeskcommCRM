import type { ModeloBase, SecaoDoModelo } from "@/lib/propostas/modelos/tipos";

/**
 * O MODELO DE PROPOSTA DE ENERGIA SOLAR — base da plataforma, no código (como
 * os demais de `lib/propostas/modelos/catalogo-base.ts`).
 *
 * As variáveis `{{solar.*}}` são preenchidas por `montarPropostaSolar`
 * (`lib/solar/briefing.ts`) quando a proposta nasce da calculadora. Criada à
 * mão, a proposta mostra "[a definir]" em cada uma e o editor oferece o campo
 * — a trava de envio não deixa sair um PDF com lacuna.
 */

function secao(id: string, title: string, body: string, required = true): SecaoDoModelo {
  return { id, title, titleEs: null, body, bodyEs: null, required, conditional: false };
}

const SECOES: SecaoDoModelo[] = [
  secao(
    "summary",
    "Resumo da proposta",
    "Esta proposta apresenta o dimensionamento de um {{project.name}} para {{client.company_or_name}}, em {{solar.local}}. O sistema foi calculado para gerar cerca de {{solar.geracao_mensal_kwh}} kWh por mês e reduzir a conta de energia em aproximadamente {{solar.economia_mensal}} por mês.",
  ),
  secao(
    "consumo",
    "Seu consumo hoje",
    "Consumo médio informado: {{solar.consumo_medio_kwh}} kWh/mês, em ligação {{solar.tipo_ligacao}}. Com a tarifa considerada, isso representa uma conta de cerca de {{solar.conta_atual}} por mês. O custo de disponibilidade da ligação continua sendo cobrado pela distribuidora mesmo com o sistema instalado.",
  ),
  secao(
    "sistema",
    "Sistema proposto",
    "Potência instalada: {{solar.potencia_kwp}} kWp, com {{solar.quantidade_modulos}} módulos fotovoltaicos {{solar.modulo}} e inversor {{solar.inversor}}. Área estimada de telhado ou solo: {{solar.area_m2}} m².",
  ),
  secao(
    "geracao",
    "Geração estimada",
    "Com irradiação média de {{solar.hsp}} kWh/m²/dia no local, a geração estimada é de {{solar.geracao_mensal_kwh}} kWh/mês ({{solar.geracao_anual_kwh}} kWh/ano), cobrindo cerca de {{solar.cobertura_pct}} do consumo. A geração real varia com o clima, a orientação e a inclinação dos módulos e o sombreamento.",
  ),
  secao(
    "economia",
    "Economia e retorno do investimento",
    "Economia estimada no primeiro ano: {{solar.economia_anual}} ({{solar.economia_mensal}} por mês). A conta já desconta a parcela do Fio B que a Lei 14.300 não compensa, crescente até 2028 ({{solar.fio_b_regra}}; de 2029 em diante considera-se a cobrança integral, até a ANEEL definir a regra). Considerando reajuste de tarifa de {{solar.reajuste_tarifa_pct_ano}} ao ano e a perda natural de rendimento dos módulos, o investimento se paga em cerca de {{solar.payback_anos}}, e a economia acumulada em {{solar.anos_analise}} anos é de aproximadamente {{solar.economia_total_periodo}}.",
  ),
  secao(
    "investment",
    "Investimento",
    "Investimento total: {{investment.total_formatted}}, incluindo equipamentos, estrutura de fixação, materiais elétricos, instalação, projeto e homologação junto à distribuidora.",
  ),
  secao(
    "included",
    "O que está incluído",
    "Visita técnica, projeto elétrico, solicitação de acesso e homologação junto à distribuidora, fornecimento dos equipamentos, instalação, comissionamento e configuração do monitoramento do sistema.",
  ),
  secao(
    "process",
    "Etapas até ligar o sistema",
    "1) Aprovação da proposta e assinatura do contrato. 2) Visita técnica e projeto. 3) Solicitação de acesso à distribuidora. 4) Entrega dos equipamentos e instalação. 5) Vistoria da distribuidora e troca do medidor. 6) Sistema em operação, com acompanhamento da geração.",
  ),
  secao(
    "warranty",
    "Garantias",
    "Os módulos e o inversor têm as garantias dos fabricantes, informadas na ficha técnica de cada equipamento. A instalação tem garantia do serviço prestado conforme o contrato.",
  ),
  secao(
    "terms",
    "Condições comerciais",
    "Esta proposta é válida por {{commercial_terms.validity_days}} dias. Os valores de geração e economia são estimativas baseadas nas informações fornecidas e em médias de irradiação, e podem variar. A aprovação de acesso e os prazos da distribuidora não dependem da instaladora.",
  ),
  secao("approval", "Aprovação", "De acordo, em {{approval.date}}.\n\n______________________________\n{{client.company_or_name}}"),
];

export const MODELO_ENERGIA_SOLAR: ModeloBase = Object.freeze({
  slug: "energia_solar",
  version: 1,
  sections: SECOES,
  sectionOrder: SECOES.map((s) => s.id),
}) as ModeloBase;
