/**
 * Test script for data collectors
 * Run: npx ts-node --project tsconfig.json src/scripts/test-collectors.ts
 *
 * Executes each collector individually and displays the collected data.
 * Useful for validating API connectivity and response parsing.
 */

import { loadEnvConfig } from '@next/env'
import path from 'path'

loadEnvConfig(path.resolve(process.cwd()))

async function testCollectors() {
  console.log('🧪 Testing data collectors...\n')

  // Import collectors dynamically to ensure env is loaded first
  const brapi = await import('../lib/collectors/brapi')
  const coingecko = await import('../lib/collectors/coingecko')
  const bcb = await import('../lib/collectors/bcb')
  const yahoo = await import('../lib/collectors/yahoo')
  const fred = await import('../lib/collectors/fred')
  const cryptopanic = await import('../lib/collectors/cryptopanic')
  const infomoney = await import('../lib/collectors/infomoney')

  const collectors = [
    { name: 'brapi.dev', fn: brapi.collect },
    { name: 'CoinGecko', fn: coingecko.collect },
    { name: 'BCB', fn: bcb.collect },
    { name: 'Yahoo Finance', fn: yahoo.collect },
    { name: 'FRED', fn: fred.collect },
    { name: 'CryptoPanic', fn: cryptopanic.collect },
    { name: 'InfoMoney', fn: infomoney.collect },
  ]

  const results: Array<{ name: string; success: boolean; error?: string; dataKeys?: string[] }> = []

  for (const { name, fn } of collectors) {
    console.log(`─── Testing ${name} ───`)
    const start = Date.now()

    try {
      const result = await fn()
      const elapsed = Date.now() - start

      if (result.success) {
        const dataKeys = result.data ? Object.keys(result.data) : []
        console.log(`  ✅ Success (${elapsed}ms)`)
        console.log(`  Data keys: ${dataKeys.join(', ')}`)

        // Print a summary of the data
        if (result.data && typeof result.data === 'object') {
          for (const [key, value] of Object.entries(result.data)) {
            if (Array.isArray(value)) {
              console.log(`  ${key}: ${value.length} items`)
              if (value.length > 0) {
                console.log(`    First: ${JSON.stringify(value[0]).slice(0, 120)}...`)
              }
            } else if (value && typeof value === 'object') {
              console.log(`  ${key}: ${JSON.stringify(value).slice(0, 120)}`)
            } else {
              console.log(`  ${key}: ${value}`)
            }
          }
        }

        results.push({ name, success: true, dataKeys })
      } else {
        console.log(`  ❌ Failed (${elapsed}ms): ${result.error}`)
        results.push({ name, success: false, error: result.error })
      }
    } catch (err) {
      const elapsed = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  💥 Exception (${elapsed}ms): ${msg}`)
      results.push({ name, success: false, error: msg })
    }

    console.log()
  }

  // ── Summary
  console.log('═══ SUMMARY ═══')
  const succeeded = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  console.log(`✅ ${succeeded.length}/${results.length} collectors succeeded`)
  for (const r of succeeded) {
    console.log(`  ${r.name}`)
  }

  if (failed.length > 0) {
    console.log(`❌ ${failed.length}/${results.length} collectors failed`)
    for (const r of failed) {
      console.log(`  ${r.name}: ${r.error}`)
    }
  }

  // ── Test full orchestrator
  console.log('\n═══ TESTING FULL ORCHESTRATOR ═══')
  const { collectMarketData } = await import('../lib/collectors')
  const start = Date.now()
  const { formattedContext, successfulSources, failedSources } = await collectMarketData()
  const elapsed = Date.now() - start

  console.log(`Completed in ${elapsed}ms`)
  console.log(`Successful: [${successfulSources.join(', ')}]`)
  console.log(`Failed: [${failedSources.join(', ')}]`)
  console.log(`\nFormatted context length: ${formattedContext.length} characters`)
  console.log('\n─── First 500 chars of formatted context ───')
  console.log(formattedContext.slice(0, 500))
  console.log('...\n')

  process.exit(failed.length > 0 ? 1 : 0)
}

testCollectors().catch((err) => {
  console.error('💥 Test runner crashed:', err)
  process.exit(1)
})
