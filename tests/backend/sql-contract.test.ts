import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationDirectory = join(process.cwd(), 'supabase', 'migrations')
const sql = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationDirectory, name), 'utf8'))
  .join('\n')

describe('pilot backend migration contract', () => {
  it('creates the two private schemas and leaves the future feed ungranted', () => {
    expect(sql).toContain('create schema if not exists private')
    expect(sql).toContain('create schema if not exists officials')
    expect(sql).toMatch(
      /revoke all on officials\.officials_feed_v1 from public, anon, authenticated/i,
    )
  })

  it('generates exactly the required daily work using unique database rules', () => {
    expect(sql).toContain('if v_sections <> 18')
    expect(sql).toContain('if v_facilities <> 2')
    expect(sql).toContain('verification_task_class_unique')
    expect(sql).toContain('verification_task_facility_unique')
    expect(sql).toContain('unique (school_day_id, section_id)')
  })

  it('uses fixed search paths for security-definer functions', () => {
    const definitions =
      sql.match(/security definer[\s\S]*?(?=\$\$;|\n\$\$;)/gi) ?? []
    expect(definitions.length).toBeGreaterThan(20)
    for (const definition of definitions) {
      expect(definition.toLowerCase()).toContain('search_path')
    }
  })

  it('keeps protected content in the private schema and strips private report links', () => {
    expect(sql).toContain('create table private.class_pulse_responses')
    expect(sql).toContain('create table private.student_pulse_responses')
    expect(sql).toContain('create table private.private_reports')
    const privateReportTable = sql.match(
      /create table private\.private_reports \([\s\S]*?\n\);/i,
    )?.[0]
    expect(privateReportTable).toBeDefined()
    expect(privateReportTable).not.toMatch(
      /session_id|participant|device_id|operator_id|submitted_at|timestamptz/i,
    )
    expect(privateReportTable).toContain('school_date date')
    expect(sql).toContain(
      'revoke all on public.participant_sessions from anon,authenticated',
    )
  })

  it('enforces atomic capabilities, idempotency, signed work leases, and five-minute grace', () => {
    expect(sql).toContain('delete from private.participant_capabilities')
    expect(sql).toContain('mutation_id uuid primary key')
    expect(sql).toContain('create table private.work_leases')
    expect(sql).toContain('create table private.operator_work_leases')
    expect(sql).toContain('apply_operator_mutation_v2')
    expect(sql).toContain('offline_work_outside_lease')
    expect(sql).toContain('begin_offline_capture_v2')
    expect(sql).toContain('finalize_capture_v2')
    expect(sql).toContain('invalid_capture_duration')
    expect(sql).toContain('close_expired_work')
    expect(sql).toContain(
      'completion_grace_seconds integer not null default 300',
    )
  })

  it('validates protected and facility response shapes in PostgreSQL', () => {
    expect(sql).toContain('validate_student_pulse_response')
    expect(sql).toContain('validate_class_pulse_response')
    expect(sql).toContain('validate_facility_response')
  })

  it('persists failed redemption attempts through typed denial results', () => {
    expect(sql).toContain('redeem_access_grant_v2')
    expect(sql).toContain(
      "return jsonb_build_object('ok',false,'error','invalid_grant')",
    )
    expect(sql).toContain("'participant_redemption_volume'")
  })

  it('enforces participant windows and the server completion grace', () => {
    expect(sql).toContain('redeem_access_grant_v3')
    expect(sql).toContain('submit_participant_response_v2')
    expect(sql).toContain("'assignment_not_open'")
    expect(sql).toContain("'completion_grace_expired'")
    expect(sql).toContain('make_interval(secs => v_grace_seconds)')
  })

  it('uses a private evidence bucket without browser insert rights', () => {
    expect(sql).toContain("values ('school-evidence', 'school-evidence', false")
    expect(sql).toContain(
      'Upload INSERT is intentionally absent for browser roles',
    )
    expect(sql).toContain('drop policy if exists evidence_storage_read')
    expect(sql).toContain(
      'revoke all on public.evidence_objects from anon,authenticated',
    )
    expect(sql).toContain('fingerprint_status')
    expect(sql).toContain('rpc_claim_evidence_fingerprint')
    expect(sql).toContain('backup_delete_after')
    expect(sql).toContain('rpc_authorize_evidence_download')
    expect(sql).toContain("case when kind='live_evidence'")
  })

  it('enables row security on every public application table', () => {
    const publicTables = [
      ...sql.matchAll(/create table public\.([a-z_]+)/gi),
    ].map((match) => match[1])
    expect(publicTables.length).toBeGreaterThan(10)
    for (const table of publicTables) {
      expect(sql.toLowerCase()).toContain(
        `alter table public.${table} enable row level security`,
      )
    }
  })

  it('provides a service-only restoration gate', () => {
    expect(sql).toContain('create table private.restoration_runs')
    expect(sql).toContain('restore_prepare')
    expect(sql).toContain('restore_finalize')
    expect(sql).toContain('report_signature_required')
  })
})
