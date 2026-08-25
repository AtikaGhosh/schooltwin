import { describe, expect, it } from 'vitest'

import {
  dictionaries,
  INTL_LOCALES,
  translate,
  validationMessage,
} from '@/lib/schooltwin/i18n'

describe('bilingual UI', () => {
  it('keeps the English and Odia dictionaries complete', () => {
    expect(Object.keys(dictionaries.or).sort()).toEqual(
      Object.keys(dictionaries.en).sort(),
    )
  })

  it('maps browser formatting locales and interpolates messages', () => {
    expect(INTL_LOCALES).toEqual({ en: 'en-IN', or: 'or-IN' })
    expect(
      translate('en', 'home.checksDone', { completed: 28, total: 39 }),
    ).toBe('28 of 39 checks done')
    expect(translate('or', 'nav.work')).toBe('ଆଜିର କାମ')
    expect(translate('en', 'appearance.change')).toBe('Change appearance')
    expect(translate('or', 'appearance.dark')).toBe('ଗାଢ଼')
    expect(validationMessage('en', 'students_range', { max: 42 })).toContain(
      '42',
    )
  })
})
