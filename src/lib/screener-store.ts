import { FieldValue, type CollectionReference } from 'firebase-admin/firestore'
import { adminDb } from './firebase-admin'
import type { ResultadoPipeline } from './lmp/pipeline'

async function limparSubcolecao(ref: CollectionReference) {
  const snap = await ref.get()
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = adminDb.batch()
    for (const doc of snap.docs.slice(i, i + 400)) batch.delete(doc.ref)
    await batch.commit()
  }
}

export async function gravarExecucao(asOfDate: string, r: ResultadoPipeline) {
  const runRef = adminDb.collection('screenerRuns').doc(asOfDate)
  await limparSubcolecao(runRef.collection('candidatos'))
  await limparSubcolecao(runRef.collection('reprovados'))

  const batch = adminDb.batch()
  batch.set(
    runRef,
    {
      ...r.execucao,
      listaFinal: r.candidatos.map((c) => c.ticker),
      criadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
  for (const c of r.candidatos) {
    batch.set(runRef.collection('candidatos').doc(c.ticker), {
      ticker: c.ticker,
      indiceTriagem: c.indiceTriagem,
      mapa: c.mapa,
      filtros: c.filtros,
      flags: c.flags,
      narrativa: c.narrativa ?? null,
    })
  }
  for (const rep of r.reprovados) {
    batch.set(runRef.collection('reprovados').doc(rep.ticker), { ticker: rep.ticker, motivos: rep.motivos })
  }
  await batch.commit()
}
