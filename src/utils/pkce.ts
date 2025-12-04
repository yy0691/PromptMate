// Decode PKCE code_verifier stored in state (base64url-encoded JSON: { cv: string, ts: number })
export function decodePkceVerifier(state?: string): string | undefined {
  if (!state) return undefined;
  try {
    const padded = state.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const parsed = JSON.parse(json);
    return parsed?.cv as string | undefined;
  } catch {
    return undefined;
  }
}
