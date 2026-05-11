function getTaipeiYmdRaw(d) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

export function getTaipeiDateKey(d = new Date()) {
  // Strict Asia/Taipei calendar day (GMT+8), resets at 00:00:00.
  return getTaipeiYmdRaw(d);
}

export function getTaipeiTimeHMS(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
  return parts;
}

export function getTaipeiNextMidnightMs(now = new Date()) {
  const nowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  const [ymd, hms] = nowStr.split(', ');
  const [year, month, day] = ymd.split('-').map(Number);
  const [hour, minute, second] = hms.split(':').map(Number);
  const passedMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1000, dayMs - passedMs + 1000);
}

