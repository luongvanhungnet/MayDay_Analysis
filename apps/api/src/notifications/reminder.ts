import { createHash } from 'node:crypto';
/** Deterministic primary key lets the database prevent duplicate daily reminders across restarts. */
export function reminderId(userId: string, date: string, kind: 'uas7' | 'medication'): string {
  const hex = createHash('sha256').update(`${userId}:${date}:${kind}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
