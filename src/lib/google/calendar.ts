export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
}

export async function fetchDailyCalendarEvents(token: string, dateStr: string): Promise<CalendarEvent[]> {
  try {
    const timeMin = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59+09:00`).toISOString();

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.append("timeMin", timeMin);
    url.searchParams.append("timeMax", timeMax);
    url.searchParams.append("singleEvents", "true");
    url.searchParams.append("orderBy", "startTime");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.warn("Failed to fetch calendar events:", await res.text());
      return [];
    }

    const data = await res.json();
    if (!data.items) return [];

    return data.items.map((item: {
      id: string;
      summary: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }) => ({
      id: item.id,
      summary: item.summary,
      description: item.description,
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || ""
    }));
  } catch (error) {
    console.error("fetchDailyCalendarEvents error:", error);
    return [];
  }
}
