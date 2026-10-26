/** Time-of-day greeting in Asia/Ulaanbaatar (Mongolia product). */

export type DayPart = "morning" | "afternoon" | "evening";

export function getUlaanbaatarHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ulaanbaatar",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  return Number.isFinite(hour) ? hour : 12;
}

export function getDayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function greetingForNow(now = new Date()): string {
  const part = getDayPart(getUlaanbaatarHour(now));
  switch (part) {
    case "morning":
      return "Өглөөний мэнд";
    case "afternoon":
      return "Өдрийн мэнд";
    case "evening":
      return "Үдшийн мэнд ✨";
  }
}
