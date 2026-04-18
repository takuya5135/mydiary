export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: string;
  due?: string;
}

export async function fetchDailyTasks(token: string): Promise<GoogleTask[]> {
  try {
    // 1. タスクリスト一覧を取得
    const listsRes = await fetch("https://www.googleapis.com/tasks/v1/users/@me/lists", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listsRes.ok) {
      console.warn("Google Tasks API (Lists) Error:", listsRes.status);
      return [];
    }

    const { items: lists } = await listsRes.json();
    if (!lists || lists.length === 0) return [];

    let allTasks: GoogleTask[] = [];

    // 2. 各リストからタスクを取得 (本来は並列実行が望ましいが、シンプルに最初のリストかメインリストを優先)
    // ここではすべてのリストを回って未完了タスクを集める
    for (const list of lists) {
      const tasksRes = await fetch(`https://www.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (tasksRes.ok) {
        const { items: tasks } = await tasksRes.json();
        if (tasks) {
          allTasks = [...allTasks, ...tasks];
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
