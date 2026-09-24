// @ts-ignore - Optional dependency
import { google } from "googleapis";

if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
  console.warn("⚠️  Google Calendar credentials not set. Calendar functionality will be disabled.");
}

interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{ email: string }>;
  /** Where to join. Used for an external meeting, whose link Google did not create. */
  location?: string;
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

/**
 * Get authenticated Google Calendar client
 */
function getCalendarClient() {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || !process.env.GOOGLE_CALENDAR_CLIENT_SECRET) {
    throw new Error("Google Calendar credentials not configured");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    "http://localhost" // Redirect URI (not used for service account)
  );

  // Set refresh token if available
  if (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    });
  } else {
    throw new Error("GOOGLE_CALENDAR_REFRESH_TOKEN is required. Run 'npm run get-google-token' to get a refresh token.");
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Create a Google Calendar event with Google Meet link
 */
export async function createCalendarEvent(
  date: string, // ISO date string
  time: string, // Time in HH:MM format
  title: string,
  description: string,
  candidateEmail: string,
  adminEmail?: string
): Promise<{ eventId: string; meetLink: string; htmlLink: string }> {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // Build local datetime strings — no UTC conversion; Google Calendar interprets
    // these in the context of the timeZone field (IST = Asia/Kolkata)
    const startDateTimeLocal = `${date}T${time}:00`;
    const [sh, sm] = time.split(':').map(Number);
    const endTotalMins = sh * 60 + sm + 60; // 1 hour meeting
    const endH = Math.floor(endTotalMins / 60) % 24;
    const endM = endTotalMins % 60;
    let endDateStr2 = date;
    if (endTotalMins >= 24 * 60) {
      const d2 = new Date(`${date}T00:00:00Z`);
      d2.setUTCDate(d2.getUTCDate() + 1);
      endDateStr2 = d2.toISOString().split('T')[0];
    }
    const endDateTimeLocal = `${endDateStr2}T${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}:00`;

    const fmtTime = (h: number, m: number) => {
      const ap = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      return `${h12}:${m < 10 ? '0' + m : m}${ap}`;
    };
    const dp = date.split('-').map(Number);
    const rd = new Date(Date.UTC(dp[0], dp[1] - 1, dp[2]));
    const dNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr = `${dNames[rd.getUTCDay()]} ${mNames[rd.getUTCMonth()]} ${rd.getUTCDate()}, ${rd.getUTCFullYear()}`;
    const startTimeStr = fmtTime(sh, sm);
    const endTimeStr = fmtTime(endH, endM);

    const formattedDateTime = `${dateStr} ${startTimeStr} - ${endTimeStr} (IST)`;

    const agendaText = (description && description.trim()) ? description.trim() : title;
    const summary = `${agendaText} StartupUniv @ ${formattedDateTime}`;

    const event: CalendarEvent = {
      summary: summary,
      description: description || title,
      start: {
        dateTime: startDateTimeLocal,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endDateTimeLocal,
        timeZone: "Asia/Kolkata",
      },
      attendees: [
        { email: candidateEmail },
        ...(adminEmail ? [{ email: adminEmail }] : []),
      ],
      conferenceData: {
        createRequest: {
          requestId: `${Date.now()}-${Math.random()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: "all", // Send invites to all attendees
    });

    const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri || "";
    const htmlLink = response.data.htmlLink || "";

    if (!response.data.id) {
      throw new Error("Failed to create calendar event: No event ID returned");
    }

    console.log(`✅ Calendar event created: ${response.data.id}`);
    return {
      eventId: response.data.id,
      meetLink,
      htmlLink,
    };
  } catch (error) {
    console.error("❌ Error creating calendar event:", error);
    throw error;
  }
}

/**
 * Update calendar event description (agenda)
 */
export async function updateEventDescription(
  eventId: string,
  newDescription: string
): Promise<void> {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId,
    });

    if (!existingEvent.data) {
      throw new Error("Event not found");
    }

    // Update the description
    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: {
        ...existingEvent.data,
        description: newDescription,
      },
      sendUpdates: "all",
    });

    console.log(`✅ Calendar event updated: ${eventId}`);
  } catch (error) {
    console.error("❌ Error updating calendar event:", error);
    throw error;
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: "all",
    });

    console.log(`✅ Calendar event deleted: ${eventId}`);
  } catch (error) {
    console.error("❌ Error deleting calendar event:", error);
    throw error;
  }
}

/**
 * Create a team meeting calendar event with Google Meet link
 * @param date - ISO date string
 * @param time - Time in HH:MM format
 * @param title - Meeting title
 * @param description - Meeting agenda/description
 * @param attendeeEmails - Array of email addresses for all team members
 * @param organizerEmail - Email of meeting creator
 * @param durationMinutes - Meeting duration in minutes (default: 30)
 * @param timezone - Timezone (default: Asia/Kolkata)
 */
export async function createTeamMeetingEvent(
  date: string, // ISO date string
  time: string, // Time in HH:MM format
  title: string,
  description: string,
  attendeeEmails: string[],
  organizerEmail: string,
  durationMinutes: number = 30,
  timezone: string = "Asia/Kolkata",
  /**
   * A join link the mentor supplied, for a session held somewhere other than Google Meet.
   * When present, no Meet conference is requested and this link is carried on the event instead,
   * so attendees still get the invite and reminder they always have -- pointing at Zoom or Teams.
   */
  externalLink?: string
): Promise<{ eventId: string; meetLink: string; htmlLink: string }> {
  try {
    const calendar = getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    // Build local datetime strings without converting to UTC.
    // Google Calendar interprets dateTime in the context of timeZone when no Z/offset is present.
    const startDateTimeLocal = `${date}T${time}:00`;

    // Compute end time by pure arithmetic on the HH:MM parts (no timezone conversion)
    const [startHours, startMins] = time.split(':').map(Number);
    const totalEndMins = startHours * 60 + startMins + durationMinutes;
    const endHoursNum = Math.floor(totalEndMins / 60) % 24;
    const endMinsNum = totalEndMins % 60;
    let endDate = date;
    if (totalEndMins >= 24 * 60) {
      // Meeting crosses midnight — advance date by 1 using UTC arithmetic on date-only string
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      endDate = d.toISOString().split('T')[0];
    }
    const endHoursStr = endHoursNum.toString().padStart(2, '0');
    const endMinsStr = endMinsNum.toString().padStart(2, '0');
    const endDateTimeLocal = `${endDate}T${endHoursStr}:${endMinsStr}:00`;

    // Format time string for display in email subject
    const formatLocalTime = (h: number, m: number): string => {
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      const mStr = m < 10 ? `0${m}` : m;
      return `${h12}:${mStr}${ampm}`;
    };

    const startTimeStr = formatLocalTime(startHours, startMins);
    const endTimeStr = formatLocalTime(endHoursNum, endMinsNum);

    // Format date string for display in email subject using UTC parse of date-only (safe)
    const dateParts = date.split('-').map(Number);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const refDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    const dateStr = `${days[refDate.getUTCDay()]} ${months[refDate.getUTCMonth()]} ${refDate.getUTCDate()}, ${refDate.getUTCFullYear()}`;

    const tzLabel = timezone === "Asia/Kolkata" ? "IST" : timezone;
    const formattedDateTime = `${dateStr} ${startTimeStr} - ${endTimeStr} (${tzLabel})`;
    const agendaText = (description && description.trim()) ? description.trim() : title;
    const summary = `${agendaText} StartupUniv @ ${formattedDateTime}`;

    const event: CalendarEvent = {
      summary: summary,
      description: externalLink
        ? `${description || title}\n\nJoin here: ${externalLink}`
        : description || title,
      start: {
        dateTime: startDateTimeLocal,
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTimeLocal,
        timeZone: timezone,
      },
      attendees: [
        { email: organizerEmail },
        ...attendeeEmails.map(email => ({ email })),
      ],
      // Either Google mints a Meet link, or the mentor's own link is carried instead. Asking for
      // both would put two competing join links in one invite.
      ...(externalLink
        ? { location: externalLink }
        : {
            conferenceData: {
              createRequest: {
                requestId: `${Date.now()}-${Math.random()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }),
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
      // Only meaningful when a conference was requested; harmless otherwise.
      conferenceDataVersion: 1,
      sendUpdates: "all", // Send invites to all attendees
    });

    const meetLink = externalLink || response.data.conferenceData?.entryPoints?.[0]?.uri || "";
    const htmlLink = response.data.htmlLink || "";

    if (!response.data.id) {
      throw new Error("Failed to create calendar event: No event ID returned");
    }

    console.log(`✅ Team meeting calendar event created: ${response.data.id}`);
    return {
      eventId: response.data.id,
      meetLink,
      htmlLink,
    };
  } catch (error) {
    console.error("❌ Error creating team meeting calendar event:", error);
    throw error;
  }
}


