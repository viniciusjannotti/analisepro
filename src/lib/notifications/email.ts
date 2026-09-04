import { Resend } from 'resend'
import { ReportType, REPORT_LABELS } from '@/lib/types'

interface EmailParams {
  to: string[]
  reportId: string
  reportType: ReportType
  preview: string
}

export async function sendEmailNotification({ to, reportId, reportType, preview }: EmailParams) {
  const label = REPORT_LABELS[reportType]
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://analisepro.vercel.app'}/relatorio/${reportId}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label.emoji} ${label.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0b0f;font-family:Inter,-apple-system,sans-serif;color:#f0f2ff;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#4f8fff,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📡</div>
      <span style="font-size:1.1rem;font-weight:800;color:#f0f2ff;">Analise<span style="color:#4f8fff;">Pro</span></span>
    </div>

    <div style="background:#161926;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;margin-bottom:20px;">
      <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#4f8fff;margin-bottom:8px;">
        ${label.emoji} Novo Relatório — ${label.title}
      </div>
      <p style="font-size:0.9rem;color:#8892b0;line-height:1.6;margin:0 0 20px;">
        ${preview.replace(/[#*_\[\]`]/g, '').slice(0, 280)}...
      </p>
      <a href="${url}" style="display:inline-block;padding:10px 20px;background:linear-gradient(135deg,#4f8fff,#7c3aed);color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.875rem;">
        Ver relatório completo →
      </a>
    </div>

    <p style="font-size:0.75rem;color:#4a5270;text-align:center;margin:0;">
      ⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento.
    </p>
  </div>
</body>
</html>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'AnalisePro <noreply@analisepro.com>',
    to,
    subject: `${label.emoji} ${label.title} — ${new Date().toLocaleDateString('pt-BR')}`,
    html,
  })
}
