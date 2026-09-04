import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const subscription = await req.json()
    if (!subscription?.endpoint) {
      return Response.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await adminDb.collection('pushSubscriptions').add({
      subscription,
      createdAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ success: true }, { status: 201 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
