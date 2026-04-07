/**
 * Bulk-load backend CSVs into Supabase lighthouse_* tables (JSONB rows).
 *
 * Usage (from frontend/):
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=secret npm run import:lighthouse
 *
 * Never commit the service role key. Rotate if it was exposed.
 */
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const DATA_ROOT = path.join(__dirname, '../../backend/EbanHaven.Api/Data/lighthouse')

/** @type {Array<[string, string, string, 'default' | 'snapshots']>} */
const FILES = [
  ['residents.csv', 'lighthouse_residents', 'resident_id', 'default'],
  ['supporters.csv', 'lighthouse_supporters', 'supporter_id', 'default'],
  ['donations.csv', 'lighthouse_donations', 'donation_id', 'default'],
  ['donation_allocations.csv', 'lighthouse_donation_allocations', 'allocation_id', 'default'],
  ['safehouses.csv', 'lighthouse_safehouses', 'safehouse_id', 'default'],
  ['process_recordings.csv', 'lighthouse_process_recordings', 'recording_id', 'default'],
  ['home_visitations.csv', 'lighthouse_home_visitations', 'visitation_id', 'default'],
  ['intervention_plans.csv', 'lighthouse_intervention_plans', 'plan_id', 'default'],
  ['education_records.csv', 'lighthouse_education_records', 'education_record_id', 'default'],
  ['health_wellbeing_records.csv', 'lighthouse_health_wellbeing_records', 'health_record_id', 'default'],
  ['public_impact_snapshots.csv', 'lighthouse_public_impact_snapshots', 'snapshot_id', 'snapshots'],
  ['safehouse_monthly_metrics.csv', 'lighthouse_safehouse_monthly_metrics', 'metric_id', 'default'],
]

function toStr(v) {
  if (v == null) return ''
  return String(v)
}

async function upsertChunks(table, rows, onConflict) {
  const size = 150
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) {
      console.error(table, error.message)
      throw error
    }
    console.log(`  ${table}: ${Math.min(i + size, rows.length)} / ${rows.length}`)
  }
}

for (const [file, table, pk, mode] of FILES) {
  const fp = path.join(DATA_ROOT, file)
  if (!fs.existsSync(fp)) {
    console.warn('Skip (missing file):', fp)
    continue
  }
  const raw = fs.readFileSync(fp, 'utf8')
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
  console.log(file, records.length, 'rows')

  if (mode === 'snapshots') {
    const rows = records.map((r) => {
      const data = {}
      for (const [k, v] of Object.entries(r)) {
        data[k] = toStr(v)
      }
      const id = parseInt(toStr(r[pk]), 10)
      const published = toStr(r.is_published).toLowerCase() === 'true'
      return { [pk]: id, published, data }
    })
    await upsertChunks(table, rows, pk)
    continue
  }

  const rows = records.map((r) => {
    const data = {}
    for (const [k, v] of Object.entries(r)) {
      data[k] = toStr(v)
    }
    const id = parseInt(toStr(r[pk]), 10)
    if (!Number.isFinite(id)) {
      console.warn('Skip row bad pk', pk, r[pk])
      return null
    }
    return { [pk]: id, data }
  }).filter(Boolean)

  await upsertChunks(table, rows, pk)
}

console.log('Done.')
