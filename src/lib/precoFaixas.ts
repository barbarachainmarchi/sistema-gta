export type PrecoFaixa = {
  quantidade_min: number
  preco_sujo: number | null
  preco_limpo: number | null
}

/** Resolve o preço correto dado a quantidade e as faixas cadastradas. */
export function resolverPrecoFaixas(
  base: { preco_sujo: number | null; preco_limpo: number | null },
  faixas: PrecoFaixa[],
  quantidade: number,
  modo: 'sujo' | 'limpo'
): number {
  if (faixas.length > 0) {
    // Pega a faixa com maior quantidade_min que ainda seja ≤ quantidade
    const sorted = [...faixas].sort((a, b) => b.quantidade_min - a.quantidade_min)
    const faixa = sorted.find(f => quantidade >= f.quantidade_min)
    if (faixa) {
      return modo === 'sujo'
        ? (faixa.preco_sujo ?? faixa.preco_limpo ?? 0)
        : (faixa.preco_limpo ?? 0)
    }
  }
  return modo === 'sujo'
    ? (base.preco_sujo ?? base.preco_limpo ?? 0)
    : (base.preco_limpo ?? 0)
}
