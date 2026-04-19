export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
}

/**
 * 有効なカレンダーの一覧を取得
 */
async function fetchCalendarList(token: string): Promise<string[]> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/users/@me/calendarList", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return ["primary"];
    const data = await res.json();
    return data.items.map((item: any) => item.id);
  } catch (err) {
    return ["primary"];
  }
}

export async function fetchDailyCalendarEvents(token: string, dateStr: string): Promise<CalendarEvent[]> {
  try {
    const timeMin = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59+09:00`).toISOString();

    const calendarIds = await fetchCalendarList(token);
    const allEvents: CalendarEvent[] = [];

    // すべてのカレンダーから予定を取得
    await Promise.all(calendarIds.map(async (id) => {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`);
      url.searchParams.append("timeMin", timeMin);
      url.searchParams.append("timeMax", timeMax);
      url.searchParams.append("singleEvents", "true");

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`GOOGLE_API_ERROR: ${res.status} ${errorData.error?.message || ""}`);
      }

      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          data.items.forEach((item: any) => {
            allEvents.push({
              id: item.id,
              summary: item.summary,
              description: item.description,
              start: item.start?.dateTime || item.start?.date || "",
              end: item.end?.dateTime || item.end?.date || ""
            });
          });
        }
      }
    }));

    // IDで重複排除し、開始時間でソート
    return Array.from(new Map(allEvents.map(e => [e.id, e])).values())
      .sort((a, b) => a.start.localeCompare(b.start));
  } catch (error: any) {
    if (error.message?.includes("GOOGLE_API_ERROR")) throw error;
    console.error("fetchDailyCalendarEvents error:", error);
    return [];
  }
}
