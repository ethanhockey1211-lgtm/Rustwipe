'use strict';

// First Thursday of a given month at 19:00 UTC (2 PM ET) — Facepunch force wipe time
function getFirstThursday(year, month) {
  const date = new Date(Date.UTC(year, month, 1));
  const dayOfWeek = date.getUTCDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  date.setUTCDate(1 + daysUntilThursday);
  date.setUTCHours(19, 0, 0, 0);
  return date;
}

function getNextForceWipe(from = new Date()) {
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  let candidate = getFirstThursday(year, month);

  if (from >= candidate) {
    month++;
    if (month > 11) { month = 0; year++; }
    candidate = getFirstThursday(year, month);
  }
  return candidate;
}

function getPreviousForceWipe(from = new Date()) {
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  let candidate = getFirstThursday(year, month);

  if (from <= candidate) {
    month--;
    if (month < 0) { month = 11; year--; }
    candidate = getFirstThursday(year, month);
  }
  return candidate;
}

function detectScheduleFromName(name, tags) {
  const combined = (name + ' ' + (Array.isArray(tags) ? tags.join(' ') : '')).toLowerCase();

  if (/\bmonthly\b/.test(combined)) return { type: 'monthly', intervalDays: 30 };
  if (/\bbiweekly\b|\bbi[\s-]weekly\b|\b2[\s-]?week\b/.test(combined)) return { type: 'biweekly', intervalDays: 14 };
  if (/\bweekly\b/.test(combined) && !/biweekly|bi-weekly/i.test(combined)) return { type: 'weekly', intervalDays: 7 };
  if (/\b3[\s-]?day\b|\b72[\s-]?hr\b/.test(combined)) return { type: '3day', intervalDays: 3 };
  if (/\bdaily\b|\b24[\s-]?hr\b|\b1[\s-]?day\b/.test(combined)) return { type: 'daily', intervalDays: 1 };

  // Infer from server type keywords
  if (/\bvanilla\b|\bofficial\b|\bfacepunch\b/.test(combined)) return { type: 'monthly', intervalDays: 30 };
  if (/\b\d{1,3}x\b|\bmodded\b/.test(combined)) return { type: 'weekly', intervalDays: 7 };

  return null;
}

function classifyInterval(days) {
  if (days < 1.5) return 'daily';
  if (days < 5) return '3day';
  if (days < 10) return 'weekly';
  if (days < 20) return 'biweekly';
  return 'monthly';
}

function predictNextWipe(server, forceWipe) {
  if (!server.rust_last_wipe) return null;

  const lastWipe = new Date(server.rust_last_wipe);
  const now = new Date();
  const daysSinceWipe = (now - lastWipe) / 86400000;

  let intervalDays = null;
  let scheduleType = null;
  let confidence = 'low';
  let source = 'estimate';

  if (server.wipe_count >= 2 && server.prev_wipe) {
    const prevWipeDate = new Date(server.prev_wipe);
    const rawInterval = (lastWipe - prevWipeDate) / 86400000;
    if (rawInterval > 0.5 && rawInterval < 45) {
      intervalDays = rawInterval;
      scheduleType = classifyInterval(rawInterval);
      confidence = server.wipe_count >= 4 ? 'high' : 'medium';
      source = 'history';
    }
  }

  // Fall back to name/tag analysis
  if (!intervalDays) {
    const nameSchedule = detectScheduleFromName(server.name, server.tags);
    if (nameSchedule) {
      intervalDays = nameSchedule.intervalDays;
      scheduleType = nameSchedule.type;
      confidence = 'medium';
      source = 'name_tags';
    }
  }

  // Last resort: guess from context
  if (!intervalDays) {
    const prevForce = getPreviousForceWipe(lastWipe);
    const daysFromForce = Math.abs((lastWipe - prevForce) / 86400000);
    if (daysFromForce < 2) {
      intervalDays = 30;
      scheduleType = 'monthly';
    } else if (daysSinceWipe > 20) {
      intervalDays = 30;
      scheduleType = 'monthly';
    } else {
      intervalDays = 7;
      scheduleType = 'weekly';
    }
    confidence = 'low';
    source = 'estimate';
  }

  // Monthly servers always wipe on Facepunch force wipe day — snap to exact time
  if (scheduleType === 'monthly' && forceWipe) {
    return {
      nextWipe: forceWipe.toISOString(),
      schedule: 'monthly',
      intervalDays,
      confidence: 'exact',
      source: 'force_wipe',
    };
  }

  // Project forward from last wipe until in the future
  let nextWipe = new Date(lastWipe.getTime() + intervalDays * 86400000);
  while (nextWipe <= now) {
    nextWipe = new Date(nextWipe.getTime() + intervalDays * 86400000);
  }

  return {
    nextWipe: nextWipe.toISOString(),
    schedule: scheduleType,
    intervalDays,
    confidence,
    source,
  };
}

module.exports = { predictNextWipe, getNextForceWipe, getPreviousForceWipe };
