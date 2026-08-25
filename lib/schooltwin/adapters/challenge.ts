import type { ChallengeGenerator, EntropySource } from './interfaces'
import type { TaskChallenge, VerificationTask } from '../domain/types'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class LocalChallengeGenerator implements ChallengeGenerator {
  constructor(private readonly entropy: EntropySource) {}

  generate(task: VerificationTask, now: Date): TaskChallenge {
    const random = this.entropy.bytes(4)
    const suffix = Array.from(
      random,
      (byte) => ALPHABET[byte % ALPHABET.length],
    ).join('')

    const sectionLabel = task.sectionId?.replace('section-', '').toUpperCase()
    const displayCode = `ST-${sectionLabel ?? 'AREA'}-${suffix}`

    return {
      id: `challenge-${task.id}`,
      taskId: task.id,
      displayCode,
      title: task.title,
      steps: [
        'Confirm the expected DrishtiShala marker.',
        'Show the requested area clearly.',
        'Pan continuously from left to right.',
        'End at the area entrance or boundary.',
      ],
      issuedAtLocal: now.toISOString(),
      prototypeIssued: true,
    }
  }
}
