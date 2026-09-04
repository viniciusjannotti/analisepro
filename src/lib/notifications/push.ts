import webpush from 'web-push'
import { adminDb } from '@/lib/firebase-admin'
import { ReportType, REPORT_LABELS } from '@/lib/types'

interface PushParams {
  reportId: string
  reportType: ReportType
}

export async function sendPushNotifications({ reportId, reportType }: PushParams) {
  webpush.setVapidDetails(
    'mailto:contato@analisepro.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const label = REPORT_LABELS[reportType]
  const payload = JSON.stringify({
    title: `${label.emoji} ${label.title}`,
    body: 'Novo relatório de mercado disponível',
    url: `/relatorio/${reportId}`,
    icon: '/icons/icon-192.png',
  })

  const snap = await adminDb.collection('pushSubscriptions').get()
  const promises = snap.docs.map(async (doc) => {
    const { subscription } = doc.data()
    try {
      await webpush.sendNotification(subscription as webpush.PushSubscription, payload)
    } catch (err) {
      const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined
      // 410 = subscription expired, clean it up
      if (statusCode === 410) {
        await doc.ref.delete()
      } else {
        console.error('[push] Failed to send to', doc.id, err instanceof Error ? err.message : err)
      }
    }
  })

  await Promise.allSettled(promises)
}
