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

// ─── Updated Prompt Templates ───────────────────────────────────────────────
// These prompts NO LONGER instruct Gemini to search the web. Instead, they
// reference the real-time market data that will be injected at the end of the
// prompt by the data collection pipeline (see src/lib/collectors/).

const PRE_MARKET_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global.

DADOS DE MERCADO EM TEMPO REAL foram coletados automaticamente de múltiplas fontes (brapi.dev, CoinGecko, Banco Central do Brasil, Yahoo Finance, FRED, CryptoPanic, InfoMoney) e estão anexados ao final desta mensagem. Utilize esses dados para fundamentar toda a sua análise. Cite sempre a fonte dos dados quando referenciar valores específicos (ex.: "segundo dados da B3 via brapi.dev", "conforme PTAX do Banco Central"). Se alguma fonte estiver marcada como indisponível, mencione essa limitação no texto.

Gere o relatório de PRÉ-MARKET do dia, com foco no que os dados coletados revelam sobre o sentimento dos mercados asiáticos e americanos (futuros) e na expectativa para a abertura da B3 e demais mercados. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global overnight e direcionamento do capital institucional, baseando-se nos dados de índices internacionais, câmbio e indicadores macro fornecidos. Cruze os dados de múltiplas fontes para construir uma narrativa coerente.
2. Calendário e Choques de Volatilidade: com base nos indicadores macro e nas manchetes fornecidas, identifique eventos e dados econômicos relevantes para a sessão de hoje, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a abertura do dia, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele — apenas inspire-se na abordagem). Baseie-se nos dados de commodities, forex e treasury yields fornecidos.
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para a abertura do dia, BASEANDO-SE NOS DADOS REAIS FORNECIDOS. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities. Use os preços e variações reais dos dados fornecidos.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."`

const MIDDAY_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global.

DADOS DE MERCADO EM TEMPO REAL foram coletados automaticamente de múltiplas fontes (brapi.dev, CoinGecko, Banco Central do Brasil, Yahoo Finance, FRED, CryptoPanic, InfoMoney) e estão anexados ao final desta mensagem. Utilize esses dados para fundamentar toda a sua análise. Cite sempre a fonte dos dados quando referenciar valores específicos. Se alguma fonte estiver marcada como indisponível, mencione essa limitação no texto.

Gere o relatório de ATUALIZAÇÃO DE PREGÃO, cobrindo o desempenho da B3 e demais mercados com base nos dados coletados neste momento do dia, e a reação a dados/eventos econômicos que os indicadores e manchetes fornecidos revelam. Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global e do direcionamento do capital institucional observado nos dados, cruzando informações de múltiplas fontes fornecidas. Use os dados de variação intraday das ações, índices e câmbio para embasar sua análise.
2. Calendário e Choques de Volatilidade: com base nos dados e manchetes fornecidos, identifique eventos já ocorridos e o que ainda falta divulgar até o fechamento, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: ajustes de proteção de portfólio recomendados para o restante do pregão, inspirados no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele). Baseie-se nos dados de commodities, forex e treasury yields fornecidos.
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno identificadas nos dados deste momento. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities. Use os preços e variações reais dos dados fornecidos.

Responda em Markdown. Ao final, inclua obrigatoriamente a linha: "⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento."`

const CLOSING_PROMPT = `Atue como Estrategista-Chefe de Investimentos e Analista de Macroeconomia Global.

DADOS DE MERCADO EM TEMPO REAL foram coletados automaticamente de múltiplas fontes (brapi.dev, CoinGecko, Banco Central do Brasil, Yahoo Finance, FRED, CryptoPanic, InfoMoney) e estão anexados ao final desta mensagem. Utilize esses dados para fundamentar toda a sua análise. Cite sempre a fonte dos dados quando referenciar valores específicos. Se alguma fonte estiver marcada como indisponível, mencione essa limitação no texto.

Gere o relatório de FECHAMENTO E BALANÇO DO DIA, cobrindo o resultado consolidado da sessão da B3, o comportamento de Forex, commodities e criptomoedas ao longo do dia (conforme dados fornecidos), e o que permanece em aberto durante a noite (Forex e cripto operam 24h). Estruture a resposta rigorosamente nos seguintes tópicos:

1. Macroeconomia e Fluxo Institucional: síntese do sentimento global do dia e do direcionamento do capital institucional, baseando-se nos dados de variação diária de ações, índices, câmbio e indicadores macro fornecidos. Cruze dados de múltiplas fontes para uma narrativa consolidada.
2. Calendário e Choques de Volatilidade: com base nos dados e manchetes fornecidos, faça o balanço dos eventos/dados econômicos do dia e identifique o que está agendado para a noite ou para amanhã cedo, com projeção de impacto na liquidez dos ativos.
3. Hedge e Visão Estratégica: recomendações de proteção de portfólio para a noite e para a abertura de amanhã, inspiradas no estilo e na filosofia de negócios publicamente conhecida de Mark Tilbury (não atribua citações literais a ele). Baseie-se nos dados de commodities, forex e treasury yields fornecidos.
4. Matriz de Oportunidades Táticas: apresente em formato de TABELA as melhores assimetrias de risco/retorno para o período noturno e para amanhã, BASEANDO-SE NOS DADOS REAIS FORNECIDOS. Colunas obrigatórias: 'Ativo', 'Mercado', 'Viés (Compra/Venda)', 'Racional/Gatilho', 'Pontos de Atenção (Stop/Risco)'. Segmente as linhas em: Ações da B3, Forex, Criptomoedas, Altcoins fora do radar, Commodities. Use os preços e variações reais dos dados fornecidos.

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
