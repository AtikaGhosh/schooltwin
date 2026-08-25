import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(simulatedSchoolTime())
})

const forbidden = [
  'Inspector',
  'District Authority',
  'Reality Gap',
  'confidence score',
  'school ranking',
  'Weekly Intelligence',
]

test('root opens the simplified pre-paired daily assistant', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/home$/)
  await expect(
    page.getByRole('heading', { name: 'Sundarpur Government High School' }),
  ).toBeVisible()
  await expect(page.getByText('28 of 39 checks done')).toBeVisible()
  await expect(page.getByText('11 left today')).toBeVisible()
  await expect(page.getByText('Prototype paired')).toHaveCount(0)
  await expect(page.getByText('Operational School Twin')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Class 8A' })).toHaveCount(0)
})

test('before opening, unfinished routine work is clearly not open yet', async ({
  page,
}) => {
  const schoolTime = simulatedSchoolTime()
  await page.clock.setFixedTime(
    new Date(schoolTime.getTime() - 4 * 60 * 60 * 1_000),
  )
  await page.goto('/home')
  await expect(page.getByText('Not open yet').first()).toBeVisible()
  await expect(page.getByText(/Today’s work opens at 10:00 am/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Record now/ })).toHaveCount(0)
})

test('operator routes survive direct navigation and exclude Officials intelligence', async ({
  page,
}) => {
  for (const route of [
    '/home',
    '/tasks',
    '/tasks/task-live-8a-daily',
    '/twin',
    '/twin/area-class-8a',
    '/twin/area-water',
    '/setup',
  ]) {
    await page.goto(route)
    await expect(page.locator('main h1')).toBeVisible()
    const surface = await page.locator('main').innerText()
    for (const term of forbidden) expect(surface).not.toContain(term)
  }
})

test('all participant routes are isolated from operator navigation', async ({
  page,
}) => {
  for (const route of [
    '/pulse/session-student-pulse-demo',
    '/school-pulse/session-class-pulse-2026-08-22-8a',
    '/report/private/session-private-report-demo',
  ]) {
    await page.goto(route)
    await expect(page.getByText('Private participant screen')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Today’s Work' })).toHaveCount(
      0,
    )
    await expect(page.getByRole('link', { name: 'History' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Our School' })).toHaveCount(0)
  }
})

test('Today’s Work groups jobs and Class 8A shows five neutral school days', async ({
  page,
}) => {
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Do now' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Later today' })).toHaveCount(
    0,
  )
  await expect(page.getByRole('heading', { name: 'Not open yet' })).toHaveCount(
    0,
  )
  await expect(page.getByText('Drinking Water')).toBeVisible()
  await expect(page.getByText('Complete before 4:00 pm').first()).toBeVisible()
  await page.getByText('View all classes').click()
  await expect(page.getByRole('row')).toHaveCount(19)
  await page.goto('/twin/area-class-8a')
  await expect(page.getByRole('heading', { name: 'Class 8A' })).toBeVisible()
  await expect(page.getByText('Last 5 school days')).toBeVisible()
  await expect(page.locator('table tbody tr')).toHaveCount(5)
  await expect(page.getByText('Students present')).toHaveCount(0)
})

test('mobile navigation has five direct destinations and matrix does not overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/home')
  const nav = page.getByRole('navigation', { name: 'Mobile primary' })
  for (const label of [
    'Home',
    'Today’s Work',
    'Our School',
    'Report Problem',
    'History',
  ])
    await expect(nav.getByRole('link', { name: label })).toBeVisible()
  await page.goto('/tasks')
  await page.getByText('View all classes').click()
  await expect(page.locator('table')).toBeHidden()
  await expect(page.getByText('Class 8A').last()).toBeVisible()
  const width = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(width).toBe(true)
})

test('dark appearance persists across operator routes and reload', async ({
  page,
}) => {
  await page.goto('/home')
  await selectAppearance(page, 'Dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  for (const route of ['/tasks', '/twin']) {
    await page.goto(route)
    await expect(page.locator('html')).toHaveClass(/dark/)
  }
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme-preference',
    'dark',
  )
})

test('Odia and dark persist while a kiosk inherits appearance without navigation', async ({
  page,
}) => {
  await page.goto('/home')
  await page.locator('button:visible').filter({ hasText: 'ଓଡ଼ିଆ' }).click()
  await page
    .locator('summary[aria-label="ଦେଖାଯିବା ଶୈଳୀ ବଦଳାନ୍ତୁ"]:visible')
    .click()
  await page.getByRole('menuitemradio', { name: /ଗାଢ଼/ }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'or-IN')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.goto('/tasks')
  const kioskHref = await page
    .locator('a[href*="/school-pulse/"][href$="8a"]')
    .first()
    .getAttribute('href')
  expect(kioskHref).toBeTruthy()
  await page.goto(kioskHref!)
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
})

test('system appearance follows browser color-scheme changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/home')
  await selectAppearance(page, 'System')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme-preference',
    'system',
  )
})

async function selectAppearance(page: Page, preference: string) {
  await page.locator('summary[aria-label="Change appearance"]:visible').click()
  await page
    .getByRole('menuitemradio', { name: new RegExp(`^${preference}`) })
    .click()
}

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
