/**
 * iCalendar (.ics) VEVENT parser (Phase 6, Track + Gmail - plan §6).
 *
 * Pure - no DB, no network, no LLM, no wall-clock reads. Calendar invites are
 * parsed from the email's `text/calendar` MIME part (not body guesswork), per
 * the safety spine in lib/track/types.ts: an invite signal must come from the
 * structured `.ics`, never from prose. Reads only the FIRST VEVENT plus the
 * top-level METHOD, unfolding RFC 5545 folded lines before any parsing.
 *
 * The only date construction here is deterministic: a fixed UTC date built from
 * explicit numeric components (no Date.now / no timezone read).
 */
import type { CalendarEvent } from "@/lib/track/types";

/** One content line split into NAME, its ;params, and the raw VALUE. */
interface IcsLine {
  name: string;
  params: string[];
  value: string;
}

/**
 * Unfold RFC 5545 folded lines: a physical line beginning with a space or TAB
 * is a continuation of the previous logical line - join it on, dropping the one
 * leading whitespace char. Handles CRLF, CR, and LF terminators.
 */
function unfold(icsRaw: string): string[] {
  const physical = icsRaw.split(/\r\n|\r|\n/);
  const logical: string[] = [];
  for (const line of physical) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

/** Split a logical line into NAME[;params]:VALUE (value may itself hold ":"). */
function parseLine(line: string): IcsLine | undefined {
  const colon = line.indexOf(":");
  if (colon === -1) return undefined;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = left.split(";");
  const name = (segments[0] ?? "").trim().toUpperCase();
  return { name, params: segments.slice(1), value };
}

/** True when any ;param is VALUE=DATE (a date-only, all-day DTSTART/DTEND). */
function isDateValueParam(params: string[]): boolean {
  return params.some((p) => p.trim().toUpperCase() === "VALUE=DATE");
}

/** ORGANIZER value → bare address: take what follows a "mailto:" if present. */
function extractOrganizer(value: string): string {
  const lower = value.toLowerCase();
  const at = lower.indexOf("mailto:");
  if (at !== -1) return value.slice(at + "mailto:".length).trim();
  return value.trim();
}

/**
 * Parse a DTSTART/DTEND value into an ISO string + allDay flag.
 *   - "YYYYMMDDThhmmssZ"          → UTC instant, e.g. "2026-06-22T16:00:00.000Z"
 *   - VALUE=DATE / bare "YYYYMMDD" → date-only "YYYY-MM-DD", allDay=true
 *   - "YYYYMMDDThhmmss" (no Z)     → best-effort local "YYYY-MM-DDThh:mm:ss"
 * Returns undefined when the value matches none of these shapes.
 */
function parseIcsDate(
  value: string,
  dateParam: boolean,
): { iso: string; allDay: boolean } | undefined {
  const v = value.trim();

  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  if (utc) {
    const year = Number(utc[1]);
    const month = Number(utc[2]);
    const day = Number(utc[3]);
    const hour = Number(utc[4]);
    const minute = Number(utc[5]);
    const second = Number(utc[6]);
    const at = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return { iso: at.toISOString(), allDay: false };
  }

  if (dateParam || /^\d{8}$/.test(v)) {
    const d = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (d) return { iso: `${d[1]}-${d[2]}-${d[3]}`, allDay: true };
  }

  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (local) {
    return {
      iso: `${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}:${local[6]}`,
      allDay: false,
    };
  }

  return undefined;
}

/**
 * Parse the FIRST VEVENT of an `.ics` payload into a CalendarEvent.
 *
 * Returns undefined when there is no VEVENT or no DTSTART. `method` is the
 * uppercased top-level METHOD (e.g. REQUEST, CANCEL); `cancelled` is true when
 * the method is CANCEL or the VEVENT STATUS is CANCELLED.
 */
export function parseIcs(icsRaw: string): CalendarEvent | undefined {
  const lines = unfold(icsRaw);

  let method: string | undefined;
  let sawVevent = false;
  let collecting = false;
  const veventLines: string[] = [];

  for (const line of lines) {
    const tag = line.trim().toUpperCase();

    if (!sawVevent && tag === "BEGIN:VEVENT") {
      sawVevent = true;
      collecting = true;
      continue;
    }

    if (collecting) {
      if (tag === "END:VEVENT") {
        collecting = false; // stop after the first VEVENT
        continue;
      }
      veventLines.push(line);
      continue;
    }

    // Top-level (VCALENDAR) properties before the first VEVENT.
    if (!sawVevent) {
      const parsed = parseLine(line);
      if (parsed && parsed.name === "METHOD" && method === undefined) {
        method = parsed.value.trim().toUpperCase();
      }
    }
  }

  if (!sawVevent) return undefined;

  let uid: string | undefined;
  let summary: string | undefined;
  let location: string | undefined;
  let status: string | undefined;
  let organizer: string | undefined;
  let dtstart: IcsLine | undefined;
  let dtend: IcsLine | undefined;

  for (const line of veventLines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    switch (parsed.name) {
      case "UID":
        if (uid === undefined) uid = parsed.value;
        break;
      case "SUMMARY":
        if (summary === undefined) summary = parsed.value;
        break;
      case "LOCATION":
        if (location === undefined) location = parsed.value;
        break;
      case "STATUS":
        if (status === undefined) status = parsed.value;
        break;
      case "ORGANIZER":
        if (organizer === undefined) organizer = extractOrganizer(parsed.value);
        break;
      case "DTSTART":
        if (dtstart === undefined) dtstart = parsed;
        break;
      case "DTEND":
        if (dtend === undefined) dtend = parsed;
        break;
      default:
        break;
    }
  }

  if (dtstart === undefined) return undefined;

  const start = parseIcsDate(dtstart.value, isDateValueParam(dtstart.params));
  const end = dtend
    ? parseIcsDate(dtend.value, isDateValueParam(dtend.params))
    : undefined;

  const cancelled =
    method === "CANCEL" ||
    (status !== undefined && status.trim().toUpperCase() === "CANCELLED");

  return {
    uid,
    method,
    summary,
    start: start?.iso,
    end: end?.iso,
    location,
    organizer,
    allDay: start?.allDay ?? false,
    cancelled,
  };
}
