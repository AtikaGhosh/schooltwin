import type { TaskIssuer } from './interfaces'
import type { VerificationTask } from '../domain/types'
import type { SchoolTwinRepository } from '../repository/types'

/** Local prototype boundary replaceable by a server-backed task issuer. */
export class RepositoryTaskIssuer implements TaskIssuer {
  constructor(private readonly repository: SchoolTwinRepository) {}

  issue(now: Date): Promise<VerificationTask[]> {
    return this.repository.getTasks(now)
  }
}
