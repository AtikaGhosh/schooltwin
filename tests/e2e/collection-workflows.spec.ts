import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(simulatedSchoolTime())
})

function simulatedSchoolTime(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return new Date(`${values.year}-${values.month}-${values.day}T07:30:00.000Z`)
}

test('Home leads directly to Class 8A video and Live Evidence persists', async ({
  page,
}) => {
  await installMockCamera(page)
  await page.goto('/home')
  await expect(page.getByText('28 of 39 checks done')).toBeVisible()
  const nextCard = page.getByText('Next').locator('..').locator('..')
  await expect(nextCard.getByText('Class 8A')).toBeVisible()
  await nextCard.getByRole('link', { name: /Record now/ }).click()
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByText('Prototype-issued challenge')).toBeVisible()
  await page.getByRole('button', { name: 'Demo marker confirmation' }).click()
  await page.getByRole('button', { name: 'Record now' }).click()
  await expect(page.getByText(/Recording continuously/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Pause/i })).toHaveCount(0)
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
  await page.clock.setFixedTime(
    new Date(simulatedSchoolTime().getTime() + 10_300),
  )
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(
    page.getByRole('heading', { name: 'Video submitted' }),
  ).toBeVisible()
  await page.getByText('Technical details').click()
  await expect(page.getByText('Evidence fingerprint generated.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Video submitted' }),
  ).toBeVisible()
  await expect(page.locator('video[controls]')).toBeVisible()
})

test('Student Private Check resumes after redemption and locks completion', async ({
  page,
}) => {
  await page.goto('/pulse/session-student-pulse-demo')
  await page.getByLabel('Enter your one-time code').fill('P7K-4M9')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.reload()
  await expect(page.getByText('1 of 2')).toBeVisible()
  await page.locator('main button[aria-pressed]:visible').first().click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.locator('main button[aria-pressed]:visible').first().click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Please hand the device back.')).toBeVisible()
})

test('demo tools exposes every section code and the private student code', async ({
  page,
}) => {
  await page.goto('/submissions')
  await page.getByText('Demo tools').click()
  await page.getByRole('link', { name: 'Demo check codes' }).click()

  await expect(page).toHaveURL(/\/demo-tools\/codes$/)
  await expect(
    page.getByRole('heading', { name: 'Demo check codes' }),
  ).toBeVisible()
  await expect(page.getByText('P7K-4M9')).toBeVisible()
  await expect(page.getByText('C8A-M9T')).toBeVisible()
  await expect(page.getByText('C9B-S8B')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open check' })).toHaveCount(19)
  await expect(
    page
      .locator('article')
      .filter({ hasText: 'P7K-4M9' })
      .getByText('Available'),
  ).toBeVisible()
  await expect(
    page.locator('article').filter({ hasText: 'C1A-K2F' }).getByText('Used'),
  ).toBeVisible()
  await expect(
    page
      .locator('article')
      .filter({ hasText: 'C8A-M9T' })
      .getByText('Available'),
  ).toBeVisible()
})

test('Class 8A Daily Class Check is guided, recoverable, and protected', async ({
  page,
}) => {
  await page.goto(`/school-pulse/session-class-pulse-${todayKey()}-8a`)
  await page.getByLabel('Enter your class code').fill('C8A-M9T')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.reload()
  await expect(page.getByText('1 of 11')).toBeVisible()
  await page.getByLabel('Students present').fill('36')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  for (let index = 0; index < 10; index += 1) {
    await page.locator('main button[aria-pressed]:visible').first().click()
    await page
      .getByRole('button', {
        name: index === 9 ? 'Submit' : 'Next',
        exact: true,
      })
      .click()
  }
  await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible()
  await page.goto('/submissions')
  await expect(
    page.getByRole('heading', { name: 'Class 8A Daily Class Check' }),
  ).toBeVisible()
  await expect(page.getByText('Students present')).toHaveCount(0)
  await expect(page.getByText('C8A-M9T')).toHaveCount(0)
})

test('Daily Facility Check is seeded consistently and completes as a seven-step wizard', async ({
  page,
}) => {
  await page.goto(`/facility-pulse/facility-pulse-${todayKey()}`)
  await expect(
    page.getByRole('heading', { name: /Daily Facility Check/ }),
  ).toBeVisible()
  await expect(page.getByText('Done')).toBeVisible()
  await reopenFacilityAssignment(page)
  await page.reload()
  await expect(page.getByText('1 of 7')).toBeVisible()
  for (let index = 0; index < 7; index += 1) {
    await page.locator('main button[aria-pressed]:visible').first().click()
    await page
      .getByRole('button', {
        name: index === 6 ? 'Submit' : 'Next',
        exact: true,
      })
      .click()
  }
  await expect(
    page.getByRole('heading', { name: /Daily Facility Check.*Done/ }),
  ).toBeVisible()
})

test('legacy Reality Check URLs redirect into isolated Daily Class Check', async ({
  page,
}) => {
  await page.goto(`/reality-check/session-class-pulse-${todayKey()}-8a`)
  await expect(page).toHaveURL(/\/school-pulse\//)
  await expect(page.getByText('Private participant screen')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Today’s Work' })).toHaveCount(0)
})

function todayKey(): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}

test('operator report is visible while private report is excluded', async ({
  page,
}) => {
  await page.goto('/report')
  await page
    .getByLabel('Tell us what happened')
    .fill('The library ceiling fan is damaged.')
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(page.getByText('Report submitted locally.')).toBeVisible()
  await page.goto('/report/private/session-private-report-demo')
  await page.getByLabel('Prototype participant code').fill('R3T-8Q2')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: /Toilet or sanitation/ }).click()
  await page
    .getByLabel('Tell us what happened')
    .fill('The student toilet near the playground is unusable.')
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(
    page.getByRole('heading', { name: 'Private report submitted' }),
  ).toBeVisible()
  await page.goto('/submissions')
  await expect(
    page.getByRole('heading', { name: 'Problem report' }),
  ).toBeVisible()
  await expect(page.getByText('student toilet')).toHaveCount(0)
  await expect(page.getByText('Private operational report')).toHaveCount(0)
})

test('sensitive report content is cleared and never persisted', async ({
  page,
}) => {
  await page.goto('/report')
  await page
    .getByLabel('Tell us what happened')
    .fill('This content must disappear before protected guidance.')
  await page
    .getByRole('button', { name: /Sensitive or immediate safety/ })
    .click()
  await page.getByRole('button', { name: 'Open protected guidance' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Use an approved protected reporting channel',
    }),
  ).toBeVisible()
  await expect(page.getByText('This content must disappear')).toHaveCount(0)
  expect(await countIndexedDbRecords(page, 'incident_reports')).toBe(0)
})

test('Demo Reset preserves language and restores exact derived totals', async ({
  page,
}) => {
  await page.goto('/home')
  await page.locator('summary[aria-label="Change appearance"]:visible').click()
  await page.getByRole('menuitemradio', { name: /^Dark/ }).click()
  await page.locator('button:visible').filter({ hasText: 'ଓଡ଼ିଆ' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'or-IN')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme-preference',
    'dark',
  )
  await page.goto('/submissions')
  await page.getByText('Demo tools').click()
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Demo Reset' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'or-IN')
  await expect(page.getByText(/୩୯|39/).first()).toBeVisible()
})

async function installMockCamera(page: Page) {
  await page.addInitScript(() => {
    class DemoMediaRecorder extends EventTarget {
      static isTypeSupported() {
        return true
      }
      state = 'inactive'
      mimeType: string
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        super()
        this.mimeType = options?.mimeType ?? 'video/webm'
      }
      start() {
        this.state = 'recording'
      }
      stop() {
        const event = new Event('dataavailable') as Event & { data: Blob }
        Object.defineProperty(event, 'data', {
          value: new Blob(['schooltwin-demo-video'], { type: this.mimeType }),
        })
        this.dispatchEvent(event)
        this.state = 'inactive'
        this.dispatchEvent(new Event('stop'))
      }
    }
    Object.defineProperty(window, 'MediaRecorder', {
      value: DemoMediaRecorder,
      configurable: true,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async () => new MediaStream() },
      configurable: true,
    })
  })
}

async function countIndexedDbRecords(
  page: Page,
  storeName: string,
): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('schooltwin-prototype')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const count = request.result
            .transaction(name)
            .objectStore(name)
            .count()
          count.onerror = () => reject(count.error)
          count.onsuccess = () => resolve(count.result)
        }
      }),
    storeName,
  )
}

async function reopenFacilityAssignment(page: Page) {
  await page.evaluate(
    (dateKey) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('schooltwin-prototype')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(
            [
              'facility_pulse_assignments',
              'facility_pulse_responses',
              'submissions',
              'audit_events',
            ],
            'readwrite',
          )
          const assignments = tx.objectStore('facility_pulse_assignments')
          const read = assignments.get(`facility-pulse-${dateKey}`)
          read.onerror = () => reject(read.error)
          read.onsuccess = () =>
            assignments.put({
              ...read.result,
              status: 'scheduled',
              startedAtLocal: undefined,
              completedAtLocal: undefined,
              scheduledStart: new Date(Date.now() - 60_000).toISOString(),
              scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
            })
          tx.objectStore('facility_pulse_responses').delete(
            `response-facility-pulse-${dateKey}`,
          )
          tx.objectStore('submissions').delete(
            `submission-facility-pulse-${dateKey}`,
          )
          tx.objectStore('audit_events').delete(
            `audit-facility-pulse-${dateKey}`,
          )
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    todayKey(),
  )
}
