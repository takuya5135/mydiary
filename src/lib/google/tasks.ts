export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: string;
  due?: string;
}

export async function fetchDailyTasks(token: string, dateStr: string): Promise<GoogleTask[]> {
  try {
    const listsRes = await fetch("https://www.googleapis.com/tasks/v1/users/@me/lists", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listsRes.ok) return [];

    const { items: lists } = await listsRes.json();
    if (!lists || lists.length === 0) return [];

    let allTasks: GoogleTask[] = [];

    for (const list of lists) {
      const tasksRes = await fetch(`https://www.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (tasksRes.ok) {
        const { items: tasks } = await tasksRes.json();
        if (tasks) {
          // 日付が一致するものだけをフィルタリング (YYYY-MM-DD かどうかで判定)
          const filtered = tasks.filter((t: any) => {
            if (!t.due) return false;
            // Google Tasks の due は "YYYY-MM-DDTHH:MM:SSZ" 形式
            return t.due.startsWith(dateStr);
          });
          allTasks = [...allTasks, ...filtered];
        }
      }
    }

    return allTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      status: t.status,
      due: t.due
    }));
  } catch (error) {
    console.error("fetchDailyTasks error:", error);
    return [];
  }
}
