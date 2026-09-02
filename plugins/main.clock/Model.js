// Pure date and format math for the clock widget and its calendar panel.
// Everything here is locale- and Qt-free so it can be unit tested under node
// (test/shell.d/clock-test.sh); the QML owns month/weekday naming through
// Qt.locale().

var MS_PER_DAY = 86400000

// Weekday indices match both JS Date.getDay() and QML's Locale.Sunday…
// Locale.Saturday, so a locale's firstDayOfWeek can be passed straight in.
var WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

// ---- Bar label formats. Right-clicking the clock walks these in order and
//      writes the result back to shell.json, so the label the bar shows and
//      the format the config stores are always the same thing.
//
// The locale-shaped time presets are each followed by their 12-hour twin, so
// the walk from a 24-hour label to the same label in AM/PM is a single right
// click rather than a lap of the ring. The ISO preset is deliberately left
// without one: ISO 8601 writes time on a 24-hour clock, so an AM/PM variant
// would contradict the only thing that format is for.
var CLOCK_FORMATS = [
  "dddd HH:mm",
  "dddd h:mm AP",
  "HH:mm",
  "h:mm AP",
  "ddd d MMM HH:mm",
  "ddd d MMM h:mm AP",
  "d MMMM 'W'ww yyyy",
  "yyyy-MM-dd HH:mm"
]

// Vertical bars have room for a few stacked lines and nothing else, so the
// ring stays short. AM/PM costs a fourth line, which is why only the plain
// time carries it here.
var VERTICAL_CLOCK_FORMATS = [
  "HH\n—\nmm",
  "h\n—\nmm\nAP",
  "dd\nMMM\n'W'ww\n''yy",
  "HH\nmm"
]

// ---- World Clock defaults. "local" resolves to the system's own zone so the
//      first row always mirrors what the bar label shows.
var DEFAULT_WORLD_CLOCKS = [
  { label: "Local", timeZone: "local" },
  { label: "UTC", timeZone: "UTC" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "London", timeZone: "Europe/London" },
  { label: "Tokyo", timeZone: "Asia/Tokyo" }
]

function normalizeWorldClockEntry(entry) {
  if (!entry || typeof entry !== "object") return null
  var label = String(entry.label || entry.name || "").replace(/^\s+|\s+$/g, "")
  var tz = String(entry.timeZone || entry.tz || entry.zone || "").replace(/^\s+|\s+$/g, "")
  if (!label || !tz) return null
  // Keep label short for the pill layout.
  if (label.length > 24) label = label.slice(0, 24)
  return { label: label, timeZone: tz }
}

function parseWorldClocks(value, fallback) {
  var source = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : DEFAULT_WORLD_CLOCKS)
  var out = []
  for (var i = 0; i < source.length; i++) {
    var normalized = normalizeWorldClockEntry(source[i])
    if (normalized) out.push(normalized)
  }
  // Never empty: at least show Local + UTC.
  if (out.length === 0) {
    var fb = Array.isArray(fallback) && fallback.length ? fallback : DEFAULT_WORLD_CLOCKS
    for (var j = 0; j < fb.length; j++) {
      var n2 = normalizeWorldClockEntry(fb[j])
      if (n2) out.push(n2)
    }
  }
  // Cap to avoid an endless pile in the popup.
  if (out.length > 8) out = out.slice(0, 8)
  return out
}

function safeTimeZone(tz) {
  var raw = String(tz || "").trim()
  if (!raw || raw.toLowerCase() === "local") {
    try {
      if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
        var sys = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (sys) return sys
      }
    } catch (e) {}
    return "local"
  }
  return raw
}

// Fallback offsets in minutes for common zones when Intl timeZone is unavailable.
// Handles DST roughly for the default set; others fallback to 0.
function fallbackOffsetMinutes(tz, date) {
  var d = date instanceof Date ? date : new Date(date)
  var m = d.getMonth() // 0-11
  // Simple DST checks: US DST ~ Mar-Nov, EU DST ~ Mar-Oct, AU DST ~ Oct-Apr
  var isUSDST = m >= 2 && m <= 10 // Mar(2) to Nov(10) inclusive, close enough
  var isEUDST = m >= 2 && m <= 9  // Mar to Oct
  var isAUDST = m <= 2 || m >= 9  // Oct to Apr
  var map = {
    "UTC": 0,
    "Etc/UTC": 0,
    "America/Los_Angeles": isUSDST ? -420 : -480,
    "America/New_York": isUSDST ? -240 : -300,
    "America/Chicago": isUSDST ? -300 : -360,
    "America/Denver": isUSDST ? -360 : -420,
    "Europe/London": isEUDST ? 60 : 0,
    "Europe/Berlin": isEUDST ? 120 : 60,
    "Europe/Paris": isEUDST ? 120 : 60,
    "Asia/Tokyo": 540,
    "Asia/Shanghai": 480,
    "Asia/Kolkata": 330,
    "Asia/Dubai": 240,
    "Australia/Sydney": isAUDST ? 660 : 600,
    "Australia/Melbourne": isAUDST ? 660 : 600
  }
  if (map[tz] !== undefined) return map[tz]
  // Unknown zone: try to guess from Intl if it ever works, else 0
  return 0
}

function pad2Fallback(n) { return (n < 10 ? "0" : "") + n }

function formatInZone(date, timeZone, opts) {
  if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return ""
  var tz = safeTimeZone(timeZone)
  if (!tz || tz === "local") {
    // "local" means system zone — format without timeZone param
    try { return new Intl.DateTimeFormat("en-US", opts).format(date) } catch (e) { return "" }
  }
  if (!tz) return ""
  try {
    return new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: tz }, opts)).format(date)
  } catch (e) { return "" }
}

function worldClockEntries(date, clocks) {
  var d = date instanceof Date ? date : new Date(date)
  var list = Array.isArray(clocks) ? clocks : DEFAULT_WORLD_CLOCKS
  var out = []
  // Local date key for day-difference badge.
  var localKey = ""
  try { localKey = formatInZone(d, "local", { year: "numeric", month: "2-digit", day: "2-digit" }) } catch (e) {}
  for (var i = 0; i < list.length; i++) {
    var entry = normalizeWorldClockEntry(list[i])
    if (!entry) continue
    var tz = safeTimeZone(entry.timeZone)
    if (!tz) continue
    var time = formatInZone(d, tz, { hour: "2-digit", minute: "2-digit", hour12: false })
    var dateLabel = formatInZone(d, tz, { month: "short", day: "numeric" })
    var weekday = formatInZone(d, tz, { weekday: "short" })
    // Day delta vs local: compare YYYY-MM-DD keys.
    var zoneKey = formatInZone(d, tz, { year: "numeric", month: "2-digit", day: "2-digit" })
    var delta = 0
    if (localKey && zoneKey && localKey !== zoneKey) {
      try {
        var lp = localKey.split("/"); var zp = zoneKey.split("/")
        // en-US gives MM/DD/YYYY
        var lDate = new Date(lp[2], lp[0]-1, lp[1])
        var zDate = new Date(zp[2], zp[0]-1, zp[1])
        delta = Math.round((zDate - lDate) / MS_PER_DAY)
      } catch (e) {}
    }
    // Offset like UTC+9 or -4:00
    var offsetStr = ""
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(d)
      for (var p = 0; p < parts.length; p++) if (parts[p].type === "timeZoneName") offsetStr = parts[p].value
      // Normalize GMT+9 -> UTC+9, GMT -> UTC
      offsetStr = offsetStr.replace(/^GMT/, "UTC")
      if (offsetStr === "UTC") offsetStr = "UTC+0"
    } catch (e) {}
    // Fallback when Intl timeZone is unsupported in QML (returns "").
    if (!time || !dateLabel || !weekday) {
      // Handle "local" specially: compute via UTC + local offset
      if (String(entry.timeZone).toLowerCase() === "local" || tz === "local") {
        var loff2 = -d.getTimezoneOffset()
        if (loff2 === 0 && typeof Intl === "undefined") loff2 = -420
        var utcH2 = d.getUTCHours()
        var utcMi2 = d.getUTCMinutes()
        var utcMs2 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcH2, utcMi2, 0, 0)
        var targetL = new Date(utcMs2 + loff2 * 60000)
        if (!time) time = pad2Fallback(targetL.getUTCHours()) + ":" + pad2Fallback(targetL.getUTCMinutes())
        if (!dateLabel) {
          var monthsL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
          dateLabel = monthsL[targetL.getUTCMonth()] + " " + targetL.getUTCDate()
        }
        if (!weekday) {
          var wdsL = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
          weekday = wdsL[targetL.getUTCDay()]
        }
        if (!offsetStr) {
          var loff = loff2
          var signL = loff >= 0 ? "+" : "-"
          var ohL = Math.floor(Math.abs(loff)/60)
          var omL = Math.abs(loff)%60
          offsetStr = "UTC" + signL + ohL + (omL ? ":" + pad2Fallback(omL) : "")
          if (loff === 0) offsetStr = "UTC+0"
        }
        if (delta === 0 && (!localKey || !zoneKey)) {
          // Local vs itself is 0
          delta = 0
        }
      } else {
        var off = fallbackOffsetMinutes(tz, d)
        // Compute via UTC base: UTC hours + offset
        var utcH = d.getUTCHours()
        var utcMi = d.getUTCMinutes()
        var utcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcH, utcMi, 0, 0)
        var target = new Date(utcMs + off * 60000)
        if (!time) time = pad2Fallback(target.getUTCHours()) + ":" + pad2Fallback(target.getUTCMinutes())
        if (!dateLabel) {
          var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
          dateLabel = months[target.getUTCMonth()] + " " + target.getUTCDate()
        }
        if (!weekday) {
          var wds = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
          weekday = wds[target.getUTCDay()]
        }
        if (!offsetStr) {
          var sign = off >= 0 ? "+" : "-"
          var oh = Math.floor(Math.abs(off)/60)
          var om = Math.abs(off)%60
          offsetStr = "UTC" + sign + oh + (om ? ":" + pad2Fallback(om) : "")
          if (off === 0) offsetStr = "UTC+0"
        }
        if (delta === 0 && (!localKey || !zoneKey)) {
          var localDay = d.getDate()
          var targetDay = target.getUTCDate()
          delta = targetDay - localDay
          if (d.getUTCMonth() !== target.getUTCMonth()) {
            if (target.getUTCMonth() > d.getUTCMonth() || (d.getUTCMonth()===11 && target.getUTCMonth()===0)) delta = 1
            else if (target.getUTCMonth() < d.getUTCMonth()) delta = -1
          }
          if (delta > 1) delta = 1
          if (delta < -1) delta = -1
        }
      }
    }
    out.push({
      label: entry.label,
      timeZone: tz,
      rawZone: entry.timeZone,
      time: time,
      dateLabel: dateLabel,
      weekday: weekday,
      delta: delta,
      offset: offsetStr
    })
  }
  return out
}

function clockFormats(vertical) {
  return vertical ? VERTICAL_CLOCK_FORMATS.slice() : CLOCK_FORMATS.slice()
}

// The presets in a fixed order, plus the configured alternate and current
// format when they are something else. The order must not depend on which
// entry is current: cycling writes the result back to shell.json, and a ring
// that reshuffled itself around the current value would bounce between two
// entries instead of walking.
function clockFormatRing(configured, configuredAlt, presets) {
  var ring = []
  var candidates = (presets || []).concat([configuredAlt, configured])
  for (var i = 0; i < candidates.length; i++) {
    var format = String(candidates[i] === undefined || candidates[i] === null ? "" : candidates[i])
    if (format === "" || ring.indexOf(format) !== -1) continue
    ring.push(format)
  }
  return ring.length > 0 ? ring : ["HH:mm"]
}

// Next entry after `current`. An unknown current format (a hand-written one
// that is not in the ring) starts the walk at the top.
function nextClockFormat(ring, current) {
  if (!ring || ring.length === 0) return ""
  var index = ring.indexOf(String(current === undefined || current === null ? "" : current))
  return ring[(index + 1) % ring.length]
}

// Two-digit ISO week, substituted into a format's 'ww' token before Qt
// formats it -- Qt has no ISO week specifier of its own.
function isoWeekLiteral(year, month, day) {
  return pad2(isoWeek(year, month, day))
}

function pad2(value) {
  var n = Number(value)
  return (n < 10 ? "0" : "") + n
}

// Stable "yyyy-MM-dd" identity for a day, so a grid cell can be compared
// against today without dragging Date objects through bindings.
function dateKey(year, month, day) {
  return year + "-" + pad2(Number(month) + 1) + "-" + pad2(day)
}

function keyForDate(date) {
  return dateKey(date.getFullYear(), date.getMonth(), date.getDate())
}

function coerceWeekStart(value) {
  if (value === undefined || value === null) return null
  if (typeof value === "number")
    return isFinite(value) ? ((Math.round(value) % 7) + 7) % 7 : null

  var text = String(value).replace(/^\s+|\s+$/g, "").toLowerCase()
  if (text === "") return null

  for (var i = 0; i < WEEKDAY_NAMES.length; i++)
    if (WEEKDAY_NAMES[i] === text || WEEKDAY_NAMES[i].substr(0, 3) === text) return i

  var parsed = parseInt(text, 10)
  return isFinite(parsed) ? ((parsed % 7) + 7) % 7 : null
}

// Configured week start, falling back to the locale's own first day when
// the setting is missing or nonsense.
function normalizedWeekStart(value, fallback) {
  var configured = coerceWeekStart(value)
  if (configured !== null) return configured
  var fallbackStart = coerceWeekStart(fallback)
  return fallbackStart === null ? 1 : fallbackStart
}

function weekStartSettingName(index) {
  return WEEKDAY_NAMES[normalizedWeekStart(index, 1)]
}

// The toggle flips between the two conventions people actually switch
// between. A calendar configured to any other start (Saturday, say) is
// shown as-is and lands on Monday the first time it is toggled.
function toggledWeekStart(index) {
  return normalizedWeekStart(index, 1) === 1 ? 0 : 1
}

function weekdayOrder(weekStart) {
  var start = normalizedWeekStart(weekStart, 1)
  var out = []
  for (var i = 0; i < 7; i++) out.push((start + i) % 7)
  return out
}

// ISO-8601 week number: the week owning the Thursday of that date's
// Monday-based week. Mirrors the clock widget's 'ww' format token.
function isoWeek(year, month, day) {
  var date = new Date(Date.UTC(year, month, day))
  var weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7)
}

function dayOfYear(year, month, day) {
  return Math.round((Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / MS_PER_DAY) + 1
}

function daysInYear(year) {
  return dayOfYear(year, 11, 31)
}

// Share of the year already behind you: whole days completed over days in
// the year, so January 1 reads 0% and December 31 reads 100%.
function yearProgress(year, month, day) {
  var total = daysInYear(year)
  if (total <= 0) return 0
  return Math.max(0, Math.min(1, (dayOfYear(year, month, day) - 1) / total))
}

function yearProgressPercent(year, month, day) {
  return Math.round(yearProgress(year, month, day) * 100)
}

// Memento mori. The default span is a round number rather than anything from
// an actuarial table: the point of the bar is the reminder, not the
// arithmetic, and whoever wants a different number can say so.
var DEFAULT_LIFE_EXPECTANCY = 90

// A birth year rather than an age, so the bar keeps counting on its own
// instead of going stale the moment it is entered. 0 means "not set", which
// is also what a blank, malformed, future, or implausibly distant year means.
function parseBirthYear(value, currentYear) {
  var now = Math.round(Number(currentYear))
  if (!isFinite(now)) return 0
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d{4}$/.test(text)) return 0
  var year = parseInt(text, 10)
  if (!isFinite(year) || year > now || year < now - 120) return 0
  return year
}

// Whole years, the way people say their age: born in 1979 makes you 47 for
// all of 2026, whichever side of your birthday today falls.
function ageFromBirthYear(birthYear, currentYear) {
  var born = parseBirthYear(birthYear, currentYear)
  if (born <= 0) return 0
  return Math.round(Number(currentYear)) - born
}

// 0 means "not set", which is also what a blank, negative, fractional, or
// absurd entry means — the life bar simply stays hidden.
function parseAge(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d+$/.test(text)) return 0
  var years = parseInt(text, 10)
  if (!isFinite(years) || years <= 0 || years > 120) return 0
  return years
}

// Unset or nonsense falls back to the default rather than to zero, so the
// bar always has something to measure against.
function parseLifeExpectancy(value) {
  var text = String(value === undefined || value === null ? "" : value).replace(/^\s+|\s+$/g, "")
  if (!/^\d+$/.test(text)) return DEFAULT_LIFE_EXPECTANCY
  var years = parseInt(text, 10)
  if (!isFinite(years) || years <= 0 || years > 150) return DEFAULT_LIFE_EXPECTANCY
  return years
}

function lifeProgress(age, expectancy) {
  var years = parseAge(age)
  var span = parseLifeExpectancy(expectancy)
  if (years <= 0 || span <= 0) return 0
  return Math.max(0, Math.min(1, years / span))
}

function lifeProgressPercent(age, expectancy) {
  return Math.round(lifeProgress(age, expectancy) * 100)
}

// Always six rows of seven days. A fixed grid keeps the popup exactly the
// same height in every month, so stepping through the year never makes the
// panel jump under the pointer.
function monthGrid(year, month, weekStart, todayKey) {
  var start = normalizedWeekStart(weekStart, 1)
  var leading = (new Date(year, month, 1).getDay() - start + 7) % 7
  var cursor = new Date(year, month, 1 - leading)
  var today = String(todayKey || "")
  var weeks = []

  for (var w = 0; w < 6; w++) {
    var days = []
    var thursday = null
    for (var d = 0; d < 7; d++) {
      var cellYear = cursor.getFullYear()
      var cellMonth = cursor.getMonth()
      var cellDay = cursor.getDate()
      var weekday = cursor.getDay()
      var key = dateKey(cellYear, cellMonth, cellDay)
      if (weekday === 4) thursday = { year: cellYear, month: cellMonth, day: cellDay }
      days.push({
        key: key,
        year: cellYear,
        month: cellMonth,
        day: cellDay,
        weekday: weekday,
        inMonth: cellMonth === month && cellYear === year,
        weekend: weekday === 0 || weekday === 6,
        today: key === today
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    // Number every row by the ISO week owning its Thursday. That is the
    // definition itself for Monday-start weeks, and the only answer that
    // stays stable for the other starts, where a row straddles two ISO
    // weeks but shares all of Monday through Thursday with one of them.
    var anchor = thursday || days[0]
    weeks.push({
      week: isoWeek(anchor.year, anchor.month, anchor.day),
      days: days
    })
  }
  return weeks
}

function stepMonth(year, month, delta) {
  var target = new Date(year, Number(month) + Number(delta), 1)
  return { year: target.getFullYear(), month: target.getMonth() }
}

if (typeof module !== "undefined") {
  module.exports = {
    dateKey: dateKey,
    keyForDate: keyForDate,
    normalizedWeekStart: normalizedWeekStart,
    weekStartSettingName: weekStartSettingName,
    toggledWeekStart: toggledWeekStart,
    weekdayOrder: weekdayOrder,
    isoWeek: isoWeek,
    dayOfYear: dayOfYear,
    daysInYear: daysInYear,
    yearProgress: yearProgress,
    yearProgressPercent: yearProgressPercent,
    parseAge: parseAge,
    parseBirthYear: parseBirthYear,
    ageFromBirthYear: ageFromBirthYear,
    parseLifeExpectancy: parseLifeExpectancy,
    lifeProgress: lifeProgress,
    lifeProgressPercent: lifeProgressPercent,
    monthGrid: monthGrid,
    stepMonth: stepMonth,
    clockFormats: clockFormats,
    clockFormatRing: clockFormatRing,
    nextClockFormat: nextClockFormat,
    isoWeekLiteral: isoWeekLiteral,
    DEFAULT_WORLD_CLOCKS: DEFAULT_WORLD_CLOCKS,
    normalizeWorldClockEntry: normalizeWorldClockEntry,
    parseWorldClocks: parseWorldClocks,
    safeTimeZone: safeTimeZone,
    formatInZone: formatInZone,
    worldClockEntries: worldClockEntries
  }
}
