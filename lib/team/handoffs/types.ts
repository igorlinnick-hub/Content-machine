// Shared types for the handoff layer.
//
// Every handoff returns either void (the work is done, message
// already sent to Telegram) or a DelegateRequest asking the
// dispatcher to run a second agent's tool. The dispatcher caps
// delegation at one hop — agent A → agent B is allowed, A → B → C
// is not (prevents infinite loops + runaway costs).

export interface DelegateRequest {
  delegate: {
    agentKey: string
    intent: string
    params?: Record<string, unknown>
    // Operator-visible explanation of why this hop happened.
    // Posted to Telegram before the delegated handoff runs.
    reason?: string
  }
}

export type HandoffResult = void | DelegateRequest
