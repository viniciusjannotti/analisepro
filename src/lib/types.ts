// Shared TypeScript types for AnalisePro

export type ReportType = 'pre-market' | 'midday' | 'closing'

export interface TacticalRow {
  rowId: string
  segment: 'Ações da B3' | 'Forex' | 'Criptomoedas' | 'Altcoins fora do radar' | 'Commodities'
  asset: string
  market: string
  bias: 'Compra' | 'Venda'
  rationale: string
  riskPoints: string
}

export interface Report {
  id: string
  type: ReportType
  generatedAt: Date
  macroSection: string
  calendarSection: string
  hedgeSection: string
  tacticalTable: TacticalRow[]
  sources: string[]
  status: 'success' | 'error'
  errorMessage?: string
}

export interface PromptTemplate {
  id: ReportType
  title: string
  scheduledTimeBRT: string
  promptText: string
  updatedAt: Date
}

export interface Profile {
  id: string
  name: string
  color: string
  createdAt: Date
}

export interface Annotation {
  id: string
  profileId: string
  profileName: string
  profileColor: string
  reportId: string
  rowId?: string // if undefined = general note on the report
  note?: string
  createdAt: Date
}

export interface PushSubscription {
  id: string
  subscription: object
  createdAt: Date
}

export interface NotificationConfig {
  emailTo: string[]
  emailEnabled: boolean
  pushEnabled: boolean
}

// Profile color palette — 10 distinct colors
export const PROFILE_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#78716C', // gray
  '#0EA5E9', // light blue
] as const

export const REPORT_LABELS: Record<ReportType, { title: string; time: string; emoji: string }> = {
  'pre-market': { title: 'Pré-Market e Projeção', time: '08:00', emoji: '🌅' },
  midday: { title: 'Atualização de Metade de Pregão', time: '11:00', emoji: '☀️' },
  closing: { title: 'Fechamento e Balanço', time: '18:00', emoji: '🌆' },
}
