// Gera uma imagem PNG resumo de facção ou loja e retorna base64 (sem prefixo data:...)

const BG = '#18181b'
const BG2 = '#1f1f23'
const BORDER = '#3f3f46'
const TEXT = '#fafafa'
const MUTED = '#a1a1aa'
const FONT = '13px monospace'
const FONT_SM = '11px monospace'
const FONT_LG = 'bold 16px monospace'
const FONT_TITLE = 'bold 20px monospace'
const W = 860
const PAD = 24

function linha(ctx: CanvasRenderingContext2D, y: number, largura: number) {
  ctx.beginPath(); ctx.strokeStyle = BORDER; ctx.lineWidth = 1
  ctx.moveTo(PAD, y); ctx.lineTo(largura - PAD, y); ctx.stroke()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current); current = w
    } else { current = test }
  }
  if (current) lines.push(current)
  return lines
}

type Membro = { id: string; nome: string; vulgo: string | null; cargo_faccao: string | null; telefone: string | null; status: string }
type Veiculo = { placa: string | null; modelo: string | null; cor: string | null; proprietario_tipo: string | null; proprietario_id: string | null }
type Preco = { item_id: string; tipo: string; percentual: number | null; preco_sujo: number | null; preco_limpo: number | null }
type Produto = { id: string; nome: string }

export function gerarImagemFaccao(params: {
  nome: string; sigla: string | null; cor: string; territorio: string | null; status: string
  membros: Membro[]; veiculos: Veiculo[]; faccaoPrecos: Preco[]; todosProdutos: Produto[]
}): string {
  const { nome, sigla, cor, territorio, status, membros, veiculos, faccaoPrecos, todosProdutos } = params

  // Estimativa de altura
  const alturaEst = 120 + Math.max(membros.length, 1) * 24 + 60 + Math.max(veiculos.length, 1) * 24 + 60 + Math.max(faccaoPrecos.length, 1) * 24 + 60
  const H = Math.max(300, alturaEst + PAD * 2)

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Fundo
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)

  // Header colorido
  ctx.fillStyle = cor; ctx.fillRect(0, 0, W, 56)

  // Título
  ctx.fillStyle = '#fff'; ctx.font = FONT_TITLE
  ctx.fillText(nome, PAD, 36)
  if (sigla) {
    const nomeW = ctx.measureText(nome).width
    ctx.font = FONT; ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(`[${sigla}]`, PAD + nomeW + 10, 36)
  }

  // Status + território
  ctx.fillStyle = BG2; ctx.fillRect(0, 56, W, 36)
  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  const meta: string[] = []
  if (territorio) meta.push(`📍 ${territorio}`)
  meta.push(status === 'ativo' ? '● Ativa' : '○ Inativa')
  meta.push(`${membros.filter(m => m.status === 'ativo').length} membros ativos`)
  ctx.fillText(meta.join('   '), PAD, 80)

  let y = 110

  // ── Membros ────────────────────────────────────────────────
  ctx.fillStyle = TEXT; ctx.font = 'bold 13px monospace'
  ctx.fillText('MEMBROS', PAD, y); y += 6
  linha(ctx, y, W); y += 14

  // Cabeçalho
  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  ctx.fillText('Nome', PAD, y)
  ctx.fillText('Vulgo', PAD + 200, y)
  ctx.fillText('Cargo', PAD + 360, y)
  ctx.fillText('Telefone', PAD + 540, y)
  ctx.fillText('Status', PAD + 680, y)
  y += 6; linha(ctx, y, W); y += 14

  if (membros.length === 0) {
    ctx.fillStyle = MUTED; ctx.font = FONT_SM
    ctx.fillText('Nenhum membro', PAD, y); y += 20
  } else {
    for (const m of membros) {
      ctx.fillStyle = m.status === 'ativo' ? TEXT : MUTED; ctx.font = FONT
      ctx.fillText(m.nome, PAD, y)
      ctx.fillStyle = MUTED; ctx.font = FONT_SM
      ctx.fillText(m.vulgo ? `"${m.vulgo}"` : '—', PAD + 200, y)
      ctx.fillText(m.cargo_faccao ?? '—', PAD + 360, y)
      ctx.fillText(m.telefone ?? '—', PAD + 540, y)
      ctx.fillStyle = m.status === 'ativo' ? '#4ade80' : '#71717a'; ctx.font = FONT_SM
      ctx.fillText(m.status === 'ativo' ? 'Ativo' : 'Inativo', PAD + 680, y)
      y += 20
    }
  }
  y += 10

  // ── Veículos ────────────────────────────────────────────────
  ctx.fillStyle = TEXT; ctx.font = 'bold 13px monospace'
  ctx.fillText('VEÍCULOS', PAD, y); y += 6
  linha(ctx, y, W); y += 14

  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  ctx.fillText('Placa', PAD, y)
  ctx.fillText('Modelo', PAD + 120, y)
  ctx.fillText('Cor', PAD + 360, y)
  ctx.fillText('Proprietário', PAD + 520, y)
  y += 6; linha(ctx, y, W); y += 14

  if (veiculos.length === 0) {
    ctx.fillStyle = MUTED; ctx.font = FONT_SM
    ctx.fillText('Nenhum veículo', PAD, y); y += 20
  } else {
    for (const v of veiculos) {
      const dono = v.proprietario_tipo === 'membro'
        ? membros.find(m => m.id === (v as { proprietario_id: string | null }).proprietario_id)?.nome ?? '—'
        : v.proprietario_tipo === 'faccao' ? 'Facção' : '—'
      ctx.fillStyle = TEXT; ctx.font = FONT
      ctx.fillText(v.placa ?? '—', PAD, y)
      ctx.fillStyle = MUTED; ctx.font = FONT_SM
      ctx.fillText(v.modelo ?? '—', PAD + 120, y)
      ctx.fillText(v.cor ?? '—', PAD + 360, y)
      ctx.fillText(dono, PAD + 520, y)
      y += 20
    }
  }
  y += 10

  // ── Produtos/Preços ────────────────────────────────────────
  if (faccaoPrecos.length > 0) {
    ctx.fillStyle = TEXT; ctx.font = 'bold 13px monospace'
    ctx.fillText('PREÇOS', PAD, y); y += 6
    linha(ctx, y, W); y += 14

    ctx.font = FONT_SM; ctx.fillStyle = MUTED
    ctx.fillText('Produto', PAD, y)
    ctx.fillText('Sujo', PAD + 360, y)
    ctx.fillText('Limpo', PAD + 480, y)
    ctx.fillText('Tipo', PAD + 620, y)
    y += 6; linha(ctx, y, W); y += 14

    for (const p of faccaoPrecos) {
      const prod = todosProdutos.find(x => x.id === p.item_id)
      ctx.fillStyle = TEXT; ctx.font = FONT
      ctx.fillText(prod?.nome ?? '—', PAD, y)
      ctx.fillStyle = MUTED; ctx.font = FONT_SM
      const fmtVal = (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR')}` : '—'
      ctx.fillText(fmtVal(p.preco_sujo), PAD + 360, y)
      ctx.fillText(fmtVal(p.preco_limpo), PAD + 480, y)
      ctx.fillText(p.tipo === 'percentual' ? `${p.percentual ?? 0}%` : 'fixo', PAD + 620, y)
      y += 20
    }
  }

  // Rodapé
  ctx.fillStyle = BG2; ctx.fillRect(0, H - 30, W, 30)
  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  ctx.fillText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, PAD, H - 10)

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}

type LojaItem = { items: { nome: string; categorias_item: { nome: string } | null } | null; preco: number; preco_sujo: number | null }
type LojaFunc = { membros: { nome: string; vulgo: string | null; faccoes: { nome: string; cor_tag: string } | null } | null; cargo: string | null }

export function gerarImagemLoja(params: {
  nome: string; localizacao: string | null; tipo: string | null; status: string
  itens: LojaItem[]; funcionarios: LojaFunc[]
}): string {
  const { nome, localizacao, tipo, status, itens, funcionarios } = params

  const alturaEst = 110 + Math.max(itens.length, 1) * 22 + 60 + Math.max(funcionarios.length, 1) * 22 + 60
  const H = Math.max(280, alturaEst + PAD * 2)

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 0, W, 56)
  ctx.fillStyle = '#fff'; ctx.font = FONT_TITLE
  ctx.fillText(nome, PAD, 36)

  ctx.fillStyle = BG2; ctx.fillRect(0, 56, W, 36)
  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  const meta: string[] = []
  if (localizacao) meta.push(`📍 ${localizacao}`)
  if (tipo) meta.push(tipo)
  meta.push(status === 'ativo' ? '● Ativa' : '○ Inativa')
  meta.push(`${itens.length} itens`)
  ctx.fillText(meta.join('   '), PAD, 80)

  let y = 110

  // Itens
  ctx.fillStyle = TEXT; ctx.font = 'bold 13px monospace'
  ctx.fillText('ITENS', PAD, y); y += 6
  linha(ctx, y, W); y += 14

  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  ctx.fillText('Produto', PAD, y)
  ctx.fillText('Categoria', PAD + 360, y)
  ctx.fillText('Sujo', PAD + 540, y)
  ctx.fillText('Limpo', PAD + 660, y)
  y += 6; linha(ctx, y, W); y += 14

  if (itens.length === 0) {
    ctx.fillStyle = MUTED; ctx.font = FONT_SM
    ctx.fillText('Nenhum item', PAD, y); y += 20
  } else {
    for (const i of itens) {
      ctx.fillStyle = TEXT; ctx.font = FONT
      ctx.fillText(i.items?.nome ?? '—', PAD, y)
      ctx.fillStyle = MUTED; ctx.font = FONT_SM
      ctx.fillText(i.items?.categorias_item?.nome ?? '—', PAD + 360, y)
      const fmt = (v: number | null) => v != null ? `R$ ${v.toLocaleString('pt-BR')}` : '—'
      ctx.fillText(fmt(i.preco_sujo), PAD + 540, y)
      ctx.fillText(fmt(i.preco), PAD + 660, y)
      y += 20
    }
  }
  y += 10

  // Funcionários
  if (funcionarios.length > 0) {
    ctx.fillStyle = TEXT; ctx.font = 'bold 13px monospace'
    ctx.fillText('FUNCIONÁRIOS', PAD, y); y += 6
    linha(ctx, y, W); y += 14

    ctx.font = FONT_SM; ctx.fillStyle = MUTED
    ctx.fillText('Nome', PAD, y)
    ctx.fillText('Cargo', PAD + 300, y)
    ctx.fillText('Facção', PAD + 540, y)
    y += 6; linha(ctx, y, W); y += 14

    for (const f of funcionarios) {
      ctx.fillStyle = TEXT; ctx.font = FONT
      ctx.fillText(f.membros?.nome ?? '—', PAD, y)
      ctx.fillStyle = MUTED; ctx.font = FONT_SM
      ctx.fillText(f.cargo ?? '—', PAD + 300, y)
      ctx.fillText(f.membros?.faccoes?.nome ?? '—', PAD + 540, y)
      y += 20
    }
    y += 10
  }

  ctx.fillStyle = BG2; ctx.fillRect(0, H - 30, W, 30)
  ctx.font = FONT_SM; ctx.fillStyle = MUTED
  ctx.fillText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, PAD, H - 10)

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}

// ── Gerar imagem de uma Venda ──────────────────────────────────────────────────

type VendaItemImg = { item_nome: string; quantidade: number; preco_unit: number }

export function gerarImagemVenda(params: {
  clienteNome: string; empresaNome: string | null; empresaTipo: 'faccao' | 'loja' | null
  tipoDinheiro: 'sujo' | 'limpo'; descontoPct: number; status: string
  dataEncomenda: string | null; notas: string | null; itens: VendaItemImg[]
  entregue_por_nome: string | null
}): string {
  const { clienteNome, empresaNome, empresaTipo, tipoDinheiro, descontoPct, status, dataEncomenda, notas, itens, entregue_por_nome } = params
  const WV = 520; const PV = 18; const ROW = 20
  const extraLinhas = (dataEncomenda ? 1 : 0) + (descontoPct > 0 ? 1 : 0) + (notas ? 1 : 0) + (entregue_por_nome ? 1 : 0)
  const H = Math.max(180, 90 + extraLinhas * 16 + itens.length * ROW + 80)
  const canvas = document.createElement('canvas')
  canvas.width = WV; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Fundo
  ctx.fillStyle = '#1a1a1c'; ctx.fillRect(0, 0, WV, H)

  // Header cinza escuro
  ctx.fillStyle = '#252528'; ctx.fillRect(0, 0, WV, 44)

  // Faixa colorida fina no topo (3px) — laranja=sujo, verde=limpo
  const accentCor = tipoDinheiro === 'sujo' ? '#f97316' : '#22c55e'
  ctx.fillStyle = accentCor; ctx.fillRect(0, 0, WV, 3)

  // Badge tipo dinheiro no canto
  const badgeTxt = tipoDinheiro === 'sujo' ? 'SUJO' : 'LIMPO'
  ctx.font = 'bold 9px monospace'; ctx.fillStyle = accentCor
  const badgeW = ctx.measureText(badgeTxt).width + 10
  ctx.fillStyle = tipoDinheiro === 'sujo' ? 'rgba(249,115,22,0.15)' : 'rgba(34,197,94,0.15)'
  ctx.fillRect(WV - PV - badgeW, 10, badgeW, 16)
  ctx.font = 'bold 9px monospace'; ctx.fillStyle = accentCor
  ctx.fillText(badgeTxt, WV - PV - badgeW + 5, 22)

  // Nome do cliente
  ctx.fillStyle = '#f4f4f5'; ctx.font = 'bold 14px monospace'
  ctx.fillText(clienteNome.length > 28 ? clienteNome.slice(0, 27) + '…' : clienteNome, PV, 28)

  // Empresa
  if (empresaNome) {
    ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'
    ctx.fillText((empresaTipo === 'loja' ? '[Loja] ' : '') + empresaNome, PV, 41)
  }

  let y = 60
  ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'
  if (dataEncomenda) { ctx.fillText('Data: ' + dataEncomenda, PV, y); y += 15 }
  if (descontoPct > 0) { ctx.fillStyle = '#4ade80'; ctx.fillText('Desconto: ' + descontoPct + '%', PV, y); ctx.fillStyle = '#71717a'; y += 15 }
  y += 4

  // Separador
  ctx.beginPath(); ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 1; ctx.moveTo(PV, y); ctx.lineTo(WV - PV, y); ctx.stroke(); y += 13
  ctx.font = 'bold 9px monospace'; ctx.fillStyle = '#52525b'
  ctx.fillText('ITEM', PV, y); ctx.fillText('QTD', WV - PV - 108, y)
  ctx.fillText('UNIT.', WV - PV - 72, y); ctx.fillText('TOTAL', WV - PV - 28, y)
  y += 5
  ctx.beginPath(); ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 1; ctx.moveTo(PV, y); ctx.lineTo(WV - PV, y); ctx.stroke()
  y += ROW - 4

  let subtotal = 0
  for (const it of itens) {
    const t = it.quantidade * it.preco_unit; subtotal += t
    ctx.font = '11px monospace'; ctx.fillStyle = '#e4e4e7'
    ctx.fillText(it.item_nome.length > 24 ? it.item_nome.slice(0, 23) + '…' : it.item_nome, PV, y)
    ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'
    ctx.fillText(it.quantidade + 'x', WV - PV - 108, y)
    ctx.fillText('R$' + it.preco_unit.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), WV - PV - 74, y)
    ctx.fillStyle = '#d4d4d8'
    ctx.fillText('R$' + t.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), WV - PV - 38, y)
    y += ROW
  }
  y += 6
  ctx.beginPath(); ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 1; ctx.moveTo(PV, y); ctx.lineTo(WV - PV, y); ctx.stroke()
  y += 16

  const total = subtotal * (1 - descontoPct / 100)
  if (descontoPct > 0) {
    ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'
    ctx.fillText('Subtotal: R$' + subtotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), PV, y); y += 14
    ctx.fillStyle = '#4ade80'; ctx.fillText('-' + descontoPct + '%', PV, y)
  }
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#f4f4f5'
  ctx.fillText('TOTAL: R$' + total.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), WV - PV - 175, y - (descontoPct > 0 ? 6 : 0))
  y += 20
  if (notas) { ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'; ctx.fillText('Obs: ' + notas, PV, y); y += 14 }
  if (entregue_por_nome) { ctx.font = '10px monospace'; ctx.fillStyle = '#71717a'; ctx.fillText('Entregue por: ' + entregue_por_nome, PV, y) }

  // Rodapé
  ctx.fillStyle = '#252528'; ctx.fillRect(0, H - 18, WV, 18)
  ctx.font = '8px monospace'; ctx.fillStyle = '#52525b'
  ctx.fillText('Gerado em ' + new Date().toLocaleString('pt-BR'), PV, H - 5)

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}
