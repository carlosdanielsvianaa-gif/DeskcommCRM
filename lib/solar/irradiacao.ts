/**
 * IRRADIAÇÃO MÉDIA POR ESTADO — o ponto de partida da calculadora solar.
 *
 * O valor é a irradiação global horizontal média anual, em kWh/m²/dia (o que
 * o mercado chama de HSP, "horas de sol pleno"). São médias ESTADUAIS
 * aproximadas, na ordem de grandeza do Atlas Brasileiro de Energia Solar
 * (INPE, 2ª ed., 2017) — dentro de um estado a variação passa de 10%. Por isso
 * a tela mostra o número e deixa a pessoa trocar pelo da cidade (CRESESB
 * SunData), em vez de esconder a estimativa atrás de um resultado "exato".
 */
export interface EstadoSolar {
  readonly uf: string;
  readonly nome: string;
  readonly hsp: number;
}

export const ESTADOS_SOLARES: readonly EstadoSolar[] = Object.freeze([
  { uf: "AC", nome: "Acre", hsp: 4.6 },
  { uf: "AL", nome: "Alagoas", hsp: 5.4 },
  { uf: "AP", nome: "Amapá", hsp: 4.8 },
  { uf: "AM", nome: "Amazonas", hsp: 4.6 },
  { uf: "BA", nome: "Bahia", hsp: 5.6 },
  { uf: "CE", nome: "Ceará", hsp: 5.6 },
  { uf: "DF", nome: "Distrito Federal", hsp: 5.4 },
  { uf: "ES", nome: "Espírito Santo", hsp: 5.0 },
  { uf: "GO", nome: "Goiás", hsp: 5.4 },
  { uf: "MA", nome: "Maranhão", hsp: 5.2 },
  { uf: "MT", nome: "Mato Grosso", hsp: 5.2 },
  { uf: "MS", nome: "Mato Grosso do Sul", hsp: 5.2 },
  { uf: "MG", nome: "Minas Gerais", hsp: 5.4 },
  { uf: "PA", nome: "Pará", hsp: 4.9 },
  { uf: "PB", nome: "Paraíba", hsp: 5.6 },
  { uf: "PR", nome: "Paraná", hsp: 4.8 },
  { uf: "PE", nome: "Pernambuco", hsp: 5.6 },
  { uf: "PI", nome: "Piauí", hsp: 5.7 },
  { uf: "RJ", nome: "Rio de Janeiro", hsp: 5.0 },
  { uf: "RN", nome: "Rio Grande do Norte", hsp: 5.7 },
  { uf: "RS", nome: "Rio Grande do Sul", hsp: 4.6 },
  { uf: "RO", nome: "Rondônia", hsp: 4.7 },
  { uf: "RR", nome: "Roraima", hsp: 4.9 },
  { uf: "SC", nome: "Santa Catarina", hsp: 4.5 },
  { uf: "SP", nome: "São Paulo", hsp: 5.0 },
  { uf: "SE", nome: "Sergipe", hsp: 5.4 },
  { uf: "TO", nome: "Tocantins", hsp: 5.4 },
]);

export const UFS_SOLARES: readonly string[] = ESTADOS_SOLARES.map((e) => e.uf);

export function hspDoEstado(uf: string): number | null {
  return ESTADOS_SOLARES.find((e) => e.uf === uf.toUpperCase())?.hsp ?? null;
}
