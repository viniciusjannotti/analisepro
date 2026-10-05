import { Resend } from 'resend'
import type { CandidatoFinal } from '@/lib/lmp/pipeline'
import { enviarPushParaTodos } from './push'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://analisepro-tau.vercel.app'
const REMETENTE = process.env.RESEND_FROM ?? 'AnalisePro <onboarding@resend.dev>'

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dataCurta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

export async function enviarEmailCandidatos(args: {
  to: string[]
  asOfDate: string
  candidatos: CandidatoFinal[]
  status: string
  falhas: number
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const linhas = args.candidatos
    .map(
      (c) =>
        `<tr><td>${c.ticker}</td><td>R$ ${fmt(c.mapa.fechamento)}</td><td>R$ ${fmt(c.mapa.alvo)}</td><td>R$ ${fmt(c.mapa.invalidacao)}</td><td>${fmt(c.mapa.rr)}</td><td>${c.mapa.caminho}</td></tr>`
    )
    .join('')
  const aviso =
    args.status === 'parcial'
      ? `<p style="color:#b45309">Execução parcial: ${args.falhas} ativos sem dados nesta data.</p>`
      : ''

  const html = `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#1b1f24;max-width:640px;margin:0 auto;padding:24px">
  <h2>🎯 Candidatos do dia — ${dataCurta(args.asOfDate)}</h2>
  ${aviso}
  <table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:14px">
    <thead><tr style="text-align:left;border-bottom:1px solid #ddd"><th>Ativo</th><th>Fechamento</th><th>Alvo</th><th>Invalidação</th><th>R:R</th><th>Caminho</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>
  <p><a href="${APP_URL}/candidatos">Ver mapa de preço completo</a></p>
  <p style="font-size:12px;color:#5b6470">Ferramenta de triagem e análise. Não constitui recomendação de investimento. Indicadores heurísticos, ainda não validados por backtest.</p>
</body></html>`

  await resend.emails.send({
    from: REMETENTE,
    to: args.to,
    subject: `Candidatos do dia — ${dataCurta(args.asOfDate)}: ${args.candidatos.length} ativos`,
    html,
  })
}

export async function enviarPushCandidatos(args: { asOfDate: string; quantidade: number }) {
  await enviarPushParaTodos({
    title: `🎯 ${args.quantidade} candidatos do dia`,
    body: `Lista de ${dataCurta(args.asOfDate)} disponível`,
    url: '/candidatos',
  })
}
