// Pure date and world clock math — QML-safe (no Intl required, fallback for QML engine)
var MS_PER_DAY = 86400000

var DEFAULT_WORLD_CLOCKS = [
  { label: "San Francisco", timeZone: "America/Los_Angeles", lat: 37.7749, lon: -122.4194 },
  { label: "New York", timeZone: "America/New_York", lat: 40.7128, lon: -74.006 },
  { label: "London", timeZone: "Europe/London", lat: 51.5074, lon: -0.1278 },
  { label: "Tokyo", timeZone: "Asia/Tokyo", lat: 35.6895, lon: 139.6917 },
  { label: "Sydney", timeZone: "Australia/Sydney", lat: -33.8688, lon: 151.2093 },
  { label: "Dubai", timeZone: "Asia/Dubai", lat: 25.2048, lon: 55.2708 }
]

var DEFAULT_PRIMARY = { label: "Tokyo", timeZone: "Asia/Tokyo" }

function normalizeWorldClockEntry(entry) {
  if (!entry || typeof entry !== "object") return null
  var label = String(entry.label || entry.name || "").replace(/^\s+|\s+$/g, "")
  var tz = String(entry.timeZone || entry.tz || entry.zone || "").replace(/^\s+|\s+$/g, "")
  if (!label || !tz) return null
  if (label.length > 24) label = label.slice(0, 24)
  var lat = entry.lat !== undefined ? Number(entry.lat) : null
  var lon = entry.lon !== undefined ? Number(entry.lon) : null
  var out = { label: label, timeZone: tz }
  if (isFinite(lat)) out.lat = lat
  if (isFinite(lon)) out.lon = lon
  // Attach coords for default cities if missing
  if (out.lat === undefined || out.lon === undefined) {
    for (var i = 0; i < DEFAULT_WORLD_CLOCKS.length; i++) {
      if (DEFAULT_WORLD_CLOCKS[i].timeZone === tz) {
        out.lat = DEFAULT_WORLD_CLOCKS[i].lat
        out.lon = DEFAULT_WORLD_CLOCKS[i].lon
        break
      }
    }
  }
  return out
}

function parseWorldClocks(value, fallback) {
  var source = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : DEFAULT_WORLD_CLOCKS)
  var out = []
  for (var i = 0; i < source.length; i++) {
    var n = normalizeWorldClockEntry(source[i])
    if (n) out.push(n)
  }
  if (out.length === 0) {
    var fb = Array.isArray(fallback) && fallback.length ? fallback : DEFAULT_WORLD_CLOCKS
    for (var j = 0; j < fb.length; j++) {
      var n2 = normalizeWorldClockEntry(fb[j])
      if (n2) out.push(n2)
    }
  }
  if (out.length > 8) out = out.slice(0, 8)
  return out
}

function parsePrimary(value, fallback) {
  var n = normalizeWorldClockEntry(value)
  if (n) return n
  var fb = normalizeWorldClockEntry(fallback)
  if (fb) return fb
  return DEFAULT_PRIMARY
}

function fallbackOffsetMinutes(tz, date) {
  var d = date instanceof Date ? date : new Date(date)
  var m = d.getMonth()
  var isUSDST = m >= 2 && m <= 10
  var isEUDST = m >= 2 && m <= 9
  var isAUDST = m <= 2 || m >= 9
  var map = {
    "UTC": 0, "Etc/UTC": 0,
    "America/Los_Angeles": isUSDST ? -420 : -480,
    "America/New_York": isUSDST ? -240 : -300,
    "America/Chicago": isUSDST ? -300 : -360,
    "America/Denver": isUSDST ? -360 : -420,
    "Europe/London": isEUDST ? 60 : 0,
    "Europe/Berlin": isEUDST ? 120 : 60,
    "Europe/Paris": isEUDST ? 120 : 60,
    "Asia/Tokyo": 540, "Asia/Shanghai": 480, "Asia/Kolkata": 330, "Asia/Dubai": 240,
    "Australia/Sydney": isAUDST ? 660 : 600, "Australia/Melbourne": isAUDST ? 660 : 600
  }
  if (map[tz] !== undefined) return map[tz]
  return 0
}
function pad2(n) { return (n < 10 ? "0" : "") + n }

function worldClockEntries(date, clocks) {
  var d = date instanceof Date ? date : new Date(date)
  var list = Array.isArray(clocks) ? clocks : DEFAULT_WORLD_CLOCKS
  var out = []
  for (var i = 0; i < list.length; i++) {
    var entry = normalizeWorldClockEntry(list[i])
    if (!entry) continue
    var tz = entry.timeZone
    var time = "", dateLabel = "", weekday = "", offsetStr = ""
    var isLocal = String(tz).toLowerCase() === "local"
    // Try Intl if available
    if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      try {
        var fmt = { timeZone: isLocal ? undefined : tz }
        time = new Intl.DateTimeFormat("en-US", Object.assign({ hour: "2-digit", minute: "2-digit", hour12: false }, isLocal ? {} : fmt)).format(d)
        dateLabel = new Intl.DateTimeFormat("en-US", Object.assign({ month: "short", day: "numeric" }, isLocal ? {} : fmt)).format(d)
        weekday = new Intl.DateTimeFormat("en-US", Object.assign({ weekday: "short" }, isLocal ? {} : fmt)).format(d)
        try {
          var parts = new Intl.DateTimeFormat("en-US", Object.assign({ timeZoneName: "shortOffset" }, isLocal ? {} : fmt)).formatToParts(d)
          for (var p = 0; p < parts.length; p++) if (parts[p].type === "timeZoneName") offsetStr = parts[p].value
          offsetStr = offsetStr.replace(/^GMT/, "UTC")
          if (offsetStr === "UTC") offsetStr = "UTC+0"
        } catch(e) {}
      } catch(e) {}
    }
    if (!time || !dateLabel || !weekday) {
      var off
      if (isLocal) {
        var loff = -d.getTimezoneOffset()
        if (loff === 0 && typeof Intl === "undefined") loff = -420
        off = loff
        var utcMsL = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0)
        var targetL = new Date(utcMsL + off * 60000)
        if (!time) time = pad2(targetL.getUTCHours()) + ":" + pad2(targetL.getUTCMinutes())
        if (!dateLabel) { var mL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; dateLabel = mL[targetL.getUTCMonth()] + " " + targetL.getUTCDate() }
        if (!weekday) { var wL=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; weekday = wL[targetL.getUTCDay()] }
        if (!offsetStr) { var sL = off >=0 ? "+" : "-"; var ohL=Math.floor(Math.abs(off)/60); var omL=Math.abs(off)%60; offsetStr="UTC"+sL+ohL+(omL?":"+pad2(omL):""); if(off===0) offsetStr="UTC+0" }
      } else {
        off = fallbackOffsetMinutes(tz, d)
        var utcH = d.getUTCHours(), utcMi=d.getUTCMinutes()
        var utcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcH, utcMi, 0, 0)
        var target = new Date(utcMs + off * 60000)
        if (!time) time = pad2(target.getUTCHours()) + ":" + pad2(target.getUTCMinutes())
        if (!dateLabel) { var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; dateLabel=months[target.getUTCMonth()]+" "+target.getUTCDate() }
        if (!weekday) { var wds=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]; weekday=wds[target.getUTCDay()] }
        if (!offsetStr) { var s=off>=0?"+":"-"; var oh=Math.floor(Math.abs(off)/60); var om=Math.abs(off)%60; offsetStr="UTC"+s+oh+(om?":"+pad2(om):""); if(off===0) offsetStr="UTC+0" }
      }
    }
    // Day delta vs local
    var delta = 0
    try {
      var localOff2 = -d.getTimezoneOffset()
      if (localOff2===0 && typeof Intl==="undefined") localOff2=-420
      var isLocalEntry = isLocal
      var entryOff = isLocalEntry ? localOff2 : fallbackOffsetMinutes(tz, d)
      // If Intl worked, we already have time, but delta still needs calc if not already
      if (!isLocalEntry) {
        var utcBase = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        var localMs = utcBase + localOff2*60000 + d.getUTCHours()*3600000 + d.getUTCMinutes()*60000
        var entryMs = utcBase + entryOff*60000 + d.getUTCHours()*3600000 + d.getUTCMinutes()*60000
        // Rough delta by date
        var lDate = new Date(localMs); var eDate=new Date(entryMs)
        delta = eDate.getUTCDate() - lDate.getUTCDate()
        if (delta>1) delta=1; if(delta<-1) delta=-1
      }
    } catch(e) {}
    out.push({ label: entry.label, timeZone: tz, rawZone: entry.timeZone, time: time, dateLabel: dateLabel, weekday: weekday, offset: offsetStr, delta: delta, lat: entry.lat, lon: entry.lon })
  }
  return out
}

function primaryEntry(date, primary) {
  var p = parsePrimary(primary, DEFAULT_PRIMARY)
  var entries = worldClockEntries(date, [p])
  return entries.length ? entries[0] : null
}

if (typeof module !== "undefined") {
  module.exports = {
    DEFAULT_WORLD_CLOCKS: DEFAULT_WORLD_CLOCKS,
    DEFAULT_PRIMARY: DEFAULT_PRIMARY,
    normalizeWorldClockEntry: normalizeWorldClockEntry,
    parseWorldClocks: parseWorldClocks,
    parsePrimary: parsePrimary,
    fallbackOffsetMinutes: fallbackOffsetMinutes,
    worldClockEntries: worldClockEntries,
    primaryEntry: primaryEntry
  }
}
