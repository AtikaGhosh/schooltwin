import type { ObservationQuestion } from './types'

export const PULSE_QUESTIONS: ObservationQuestion[] = [
  {
    id: 'pulse-water',
    prompt: 'Was drinking water available to you today?',
    allowedAnswers: ['yes', 'no', 'did_not_check'],
  },
  {
    id: 'pulse-math',
    prompt: 'Did your scheduled mathematics class happen?',
    allowedAnswers: ['yes', 'no', 'not_sure'],
  },
]
