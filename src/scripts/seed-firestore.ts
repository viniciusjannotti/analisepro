/**
 * Firestore Seed Script
 * Run: npx ts-node --project tsconfig.json src/scripts/seed-firestore.ts
 * Or: node -e "require('./src/scripts/seed-firestore.js')"
 *
 * This creates the 3 promptTemplates documents and the default config/notifications doc.
 * Only needs to run once. Re-running is safe (will overwrite with same data).
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { loadEnvConfig } from '@next/env'
import path from 'path'

loadEnvConfig(path.resolve(process.cwd()))

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

const PRE_MARKET_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas 12 horas antes de responder. Gere o relatório de PRÉ-MARKET do dia, com foco no que aconteceu durante a madrugada nos mercados asiáticos e americanos (futuros) e na expectativa para a abertura da B3 e demais mercados. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global overnight e direcionamento do capital institucional, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: principais eventos e dados econômicos previstos para a sessão de hoje, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a abertura do dia, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele — apenas inspire-se na abordagem).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para a abertura do dia. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."`

const MIDDAY_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas horas antes de responder. Gere o relatório de ATUALIZAÇÃO DE PREGÃO, cobrindo o desempenho da B3 e demais mercados desde a abertura até o momento presente, e a reação a dados/eventos econômicos já publicados nesta manhã. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global e do direcionamento do capital institucional observado até agora no pregão, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: eventos e dados já divulgados nesta manhã e o que ainda falta divulgar até o fechamento, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: ajustes de proteção de portfólio recomendados para o restante do pregão, inspirados no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno identificadas até este momento do dia. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."`

const CLOSING_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global. Use a busca na web para obter informações das últimas horas antes de responder. Gere o relatório de FECHAMENTO E BALANÇO DO DIA, cobrindo o resultado consolidado da sessão da B3, o comportamento de Forex, commodities e criptomoedas ao longo do dia, e o que permanece em aberto durante a noite (Forex e cripto operam 24h). Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global do dia e do direcionamento do capital institucional, cruzando análises e notícias recentes da Bloomberg, The Wall Street Journal, CNN Brasil Money e Seeking Alpha. Cite a fonte e a data/hora aproximada de cada informação relevante.
2. Calendário e Choques de Volatilidade: balanço dos eventos/dados econômicos do dia e o que está agendado para a noite ou para amanhã cedo, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a noite e para a abertura de amanhã, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele).
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para o período noturno e para amanhã. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."`

async function seed() {
  console.log('🌱 Seeding Firestore...')

  const templates = [
    {
      id: 'pre-market',
      title: 'Pré-Market e Projeção',
      scheduledTimeBRT: '08:00',
      promptText: PRE_MARKET_PROMPT,
    },
    {
      id: 'midday',
      title: 'Atualização de Metade de Pregão',
      scheduledTimeBRT: '11:00',
      promptText: MIDDAY_PROMPT,
    },
    {
      id: 'closing',
      title: 'Fechamento e Balanço',
      scheduledTimeBRT: '18:00',
      promptText: CLOSING_PROMPT,
    },
  ]

  for (const tpl of templates) {
    const { id, ...data } = tpl
    await db
      .collection('promptTemplates')
      .doc(id)
      .set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    console.log(`  ✓ promptTemplates/${id}`)
  }

  // Default notifications config
  await db
    .collection('config')
    .doc('notifications')
    .set(
      {
        emailTo: [],
        emailEnabled: false,
        pushEnabled: false,
      },
      { merge: true }
    )
  console.log('  ✓ config/notifications')

  console.log('✅ Seed complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
