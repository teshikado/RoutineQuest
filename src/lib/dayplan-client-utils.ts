/** Pure, dependency-free helpers shared by day-planning client components. Deliberately
 * separate from src/lib/dayplan-service.ts, which imports the Prisma client and must never
 * end up in a client bundle. */

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function durationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, timeToMinutes(time) + minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}
