/** Format exact des codes émis par /api/threads/delete : 16 octets en hexadécimal minuscule. */
const CONFIRMATION_CODE = /^[0-9a-f]{32}$/

export function isConfirmationCode(value: unknown): value is string {
  return typeof value === 'string' && CONFIRMATION_CODE.test(value)
}
