export function createEaBridgeSeed() {
  return {
    instances: [],
    sessions: [],
    messages: [],
    commands: [],
    logs: [],
    diagnostics: [],
    issuedCredentialSecrets: {} as Record<string, { ingestionTokenHash: string; signingSecret: string }>
  };
}
