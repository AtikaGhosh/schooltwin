import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'

import {
  IndexedDbSchoolTwinRepository,
  openSchoolTwinDb,
  SCHOOLTWIN_DB_VERSION,
} from '@/lib/schooltwin/repository/indexeddb'
import type { School, Submission } from '@/lib/schooltwin/domain/types'

const dbNames: string[] = []
const fixedNow = new Date('2026-08-22T10:00:00.000Z')

function createRepository() {
  const dbName = `schooltwin-test-${dbNames.length}`
  dbNames.push(dbName)
  return new IndexedDbSchoolTwinRepository({
    dbName,
    now: () => new Date(fixedNow),
    hashCode: async (value) => `hash:${value.trim().toUpperCase()}`,
  })
}

afterEach(async () => {
  await Promise.all(dbNames.splice(0).map((name) => deleteDB(name)))
})

describe('IndexedDbSchoolTwinRepository v5 demo-day coverage', () => {
  it('upgrades v3 without deleting legacy records and backfills daily coverage', async () => {
    const name = 'schooltwin-v3-upgrade-test'
    dbNames.push(name)
    const v3 = await openSchoolTwinDb(name, 3)
    await v3.put('schools', {
      id: 'legacy-school',
      schoolTwinId: 'ST-LEGACY',
      name: 'Legacy Demo School',
      district: 'Test',
      state: 'Test',
      studentCount: 1,
      teacherCount: 1,
      sectionCount: 1,
      pairedAtLocal: fixedNow.toISOString(),
    } as unknown as School)
    await v3.put('submissions', {
      id: 'legacy-submission',
      schoolId: 'legacy-school',
      sourceRecordId: 'legacy-record',
      kind: 'operator_report',
      title: 'Preserved legacy report',
      status: 'submitted',
      visibility: 'operator',
      submittedAtLocal: fixedNow.toISOString(),
    })
    await v3.put('pulse_responses', {
      id: 'legacy-private-pulse',
      schoolId: 'legacy-school',
      sessionId: 'legacy-private-session',
      accessGrantId: 'legacy-private-grant',
      answers: [{ questionId: 'legacy-question', answer: 'yes' }],
      submittedAtLocal: fixedNow.toISOString(),
    })
    await v3.put('reality_checks', {
      id: 'legacy-class-observation',
      schoolId: 'legacy-school',
      taskId: 'legacy-task',
      sessionId: 'legacy-class-session',
      sectionId: 'legacy-section',
      accessGrantId: 'legacy-class-grant',
      answers: [{ questionId: 'legacy-question', answer: 'no' }],
      submittedAtLocal: fixedNow.toISOString(),
    })
    await v3.put('capture_artifacts', {
      id: 'legacy-capture',
      schoolId: 'legacy-school',
      taskId: 'legacy-task',
      challengeId: 'legacy-challenge',
      startedAtLocal: fixedNow.toISOString(),
      endedAtLocal: fixedNow.toISOString(),
      durationMs: 10_000,
      markerMethod: 'demo_confirmation',
      expectedMarkerMatched: true,
      sha256: 'legacy-fingerprint',
      mimeType: 'video/webm',
      byteLength: 4,
      blobKey: 'legacy-blob',
    })
    await v3.put('capture_blobs', {
      key: 'legacy-blob',
      blob: new Blob(['keep']),
    })
    v3.close()

    const repository = new IndexedDbSchoolTwinRepository({
      dbName: name,
      now: () => fixedNow,
      hashCode: async (value) => `hash:${value}`,
    })
    await repository.initialize()
    expect(
      (await repository.getOperatorSubmissions()).some(
        (item) => item.id === 'legacy-submission',
      ),
    ).toBe(true)
    expect(
      (await repository.getOperatorDailyCoverage(fixedNow)).totalSections,
    ).toBe(18)
    repository.close()

    const current = await openSchoolTwinDb(name, SCHOOLTWIN_DB_VERSION)
    expect(Array.from(current.objectStoreNames)).toContain(
      'class_pulse_assignments',
    )
    expect(Array.from(current.objectStoreNames)).toContain(
      'facility_pulse_responses',
    )
    expect(await current.count('pulse_responses')).toBe(1)
    expect(await current.count('reality_checks')).toBe(1)
    expect(await current.count('capture_artifacts')).toBe(1)
    expect(await current.count('capture_blobs')).toBe(1)
    expect(await current.get('schools', 'legacy-school')).toMatchObject({
      timeZone: 'Asia/Kolkata',
      openingTime: '10:00',
      closingTime: '16:00',
    })
    current.close()
  })

  it('creates 18 Class Pulses, 18 Live Class Evidence tasks, and consistent completion records', async () => {
    const repository = createRepository()
    await repository.initialize()
    const coverage = await repository.getOperatorDailyCoverage(fixedNow)
    const tasks = await repository.getTasks(fixedNow)
    const submissions = await repository.getOperatorSubmissions()
    const events = await repository.getAuditEvents()

    expect(coverage.rows).toHaveLength(18)
    expect(coverage.classPulseSubmitted).toBe(14)
    expect(coverage.liveEvidenceSubmitted).toBe(12)
    expect(
      tasks.filter((task) => task.liveEvidenceScope === 'class'),
    ).toHaveLength(18)
    expect(
      tasks.filter((task) => task.liveEvidenceScope === 'facility'),
    ).toHaveLength(2)
    expect(
      submissions.filter((item) => item.kind === 'class_pulse'),
    ).toHaveLength(14)
    expect(
      events.filter((item) => item.type === 'class_pulse_submitted'),
    ).toHaveLength(14)
    repository.close()
  })

  it('backfills a new current day when only earlier Pulse days exist', async () => {
    const name = 'schooltwin-next-day-test'
    dbNames.push(name)
    const first = new IndexedDbSchoolTwinRepository({
      dbName: name,
      now: () => fixedNow,
      hashCode: async (value) => `hash:${value}`,
    })
    await first.initialize()
    first.close()

    const nextDay = new Date('2026-08-23T10:00:00.000Z')
    const reopened = new IndexedDbSchoolTwinRepository({
      dbName: name,
      now: () => nextDay,
      hashCode: async (value) => `hash:${value}`,
    })
    await reopened.initialize()
    expect((await reopened.getCurrentPulseDay(nextDay)).dateKey).toBe(
      '2026-08-23',
    )
    expect(
      (await reopened.getOperatorDailyCoverage(nextDay)).rows,
    ).toHaveLength(18)
    reopened.close()
  })

  it('uses unique hashed Class Pulse grants and rejects reuse', async () => {
    const repository = createRepository()
    await repository.initialize()
    const coverage = await repository.getOperatorDailyCoverage(fixedNow)
    const class8A = coverage.rows.find((row) => row.sectionName === 'Class 8A')!
    const first = await repository.redeemAccessGrant(
      class8A.classPulse.sessionId,
      'C8A-M9T',
      fixedNow,
    )
    const second = await repository.redeemAccessGrant(
      class8A.classPulse.sessionId,
      'C8A-M9T',
      fixedNow,
    )
    const wrongSection = await repository.redeemAccessGrant(
      coverage.rows.find((row) => row.sectionName === 'Class 8B')!.classPulse
        .sessionId,
      'C8A-M9T',
      fixedNow,
    )
    expect(first.ok).toBe(true)
    expect(
      await repository.getActiveRedeemedGrant(
        class8A.classPulse.sessionId,
        fixedNow,
      ),
    ).toEqual({
      accessGrantId: expect.any(String),
      sessionId: class8A.classPulse.sessionId,
      status: 'active',
    })
    expect(second).toEqual({ ok: false, reason: 'used' })
    expect(wrongSection).toEqual({ ok: false, reason: 'invalid' })
    repository.close()
  })

  it('preserves the selected UI locale through Demo Reset', async () => {
    const repository = createRepository()
    await repository.initialize()
    await repository.saveUiLocale('or')
    await repository.resetDemo(fixedNow)
    expect(await repository.getUiLocale()).toBe('or')
    repository.close()
  })

  it('rejects expired private Student Pulse grants', async () => {
    const repository = createRepository()
    await repository.initialize()
    const result = await repository.redeemAccessGrant(
      'session-student-pulse-demo',
      'P7K-4M9',
      new Date('2026-08-22T18:35:00.000Z'),
    )
    expect(result).toEqual({ ok: false, reason: 'expired' })
    repository.close()
  })

  it('filters protected submissions from operator projections', async () => {
    const repository = createRepository()
    await repository.initialize()
    const privateSubmission: Submission = {
      id: 'submission-private',
      schoolId: 'school-sundarpur',
      sourceRecordId: 'report-private',
      kind: 'private_report',
      title: 'This title must not reach the operator',
      status: 'submitted',
      visibility: 'protected',
      submittedAtLocal: fixedNow.toISOString(),
    }
    await repository.saveSubmission(privateSubmission)
    expect(
      (await repository.getOperatorSubmissions()).some(
        (view) => view.id === privateSubmission.id,
      ),
    ).toBe(false)
    repository.close()
  })

  it('returns a five-day Class 8B history with neutral missing records', async () => {
    const repository = createRepository()
    await repository.initialize()
    const history = await repository.getSectionCoverageHistory(
      'section-8b',
      fixedNow,
    )
    expect(history).toHaveLength(5)
    expect(
      history.filter((item) => item.liveEvidenceStatus === 'missed').length,
    ).toBeGreaterThanOrEqual(2)
    repository.close()
  })

  it('deletes capture blobs and restores exact daily coverage on Demo Reset', async () => {
    const repository = createRepository()
    await repository.initialize()
    await repository.saveCaptureBlob(
      'blob-test',
      new Blob(['prototype evidence'], { type: 'video/webm' }),
    )
    await repository.resetDemo(fixedNow)
    expect(await repository.getCaptureBlob('blob-test')).toBeNull()
    const coverage = await repository.getOperatorDailyCoverage(fixedNow)
    expect([
      coverage.classPulseSubmitted,
      coverage.liveEvidenceSubmitted,
      coverage.totalSections,
    ]).toEqual([14, 12, 18])
    repository.close()
  })
})
