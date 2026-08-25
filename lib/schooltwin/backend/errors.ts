export class WaitingToSendError extends Error {
  readonly code = 'waiting_to_send'

  constructor() {
    super('waiting_to_send')
    this.name = 'WaitingToSendError'
  }
}

export class ServerRejectedError extends Error {
  readonly code = 'server_rejected'

  constructor(reason = 'server_rejected') {
    super(reason)
    this.name = 'ServerRejectedError'
  }
}

export function isWaitingToSendError(cause: unknown): boolean {
  return (
    cause instanceof WaitingToSendError ||
    (cause instanceof Error && cause.message === 'waiting_to_send')
  )
}
