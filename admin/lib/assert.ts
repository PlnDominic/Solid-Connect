/** Turns a failed Supabase write into a thrown error so a server action
 * fails loudly instead of the UI reporting success after a dropped write. */
export function assertOk(error: { message: string } | null | undefined, what: string): void {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}
