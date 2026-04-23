import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2, ListTodo } from "lucide-react";
import { CalendarEvent } from "@/lib/google/calendar";
import { GoogleTask } from "@/lib/google/tasks";
import { getGoogleCalendarAndTasksAction } from "@/app/actions";
import { loginWithGoogle } from "@/lib/firebase/auth";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { RefreshCw } from "lucide-react";

interface CalendarStripProps {
  userId: string;
  date: string; // YYYY-MM-DD
}

export function CalendarStrip({ userId, date }: CalendarStripProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // クライアント側（認証済み）で鍵を取得してサーバーに渡す
        // @ts-ignore
        const { getUserToken } = await import("@/lib/firebase/tokens");
        const token = await getUserToken(userId);

        if (!token) {
          setError("Google連携が必要です。再ログインを行ってください。");
          setIsLoading(false);
          return;
        }

        const result = await getGoogleCalendarAndTasksAction(userId, token, date);
        
        if (result.success) {
          setEvents((result as any).events || []);
          setTasks((result as any).tasks || []);
        } else {
          const r = result as { success: false; error?: string; isAuthError?: boolean };
          if (r.isAuthError) {
            setError(r.error || "Google API認証エラー");
          } else {
            setError(r.error || "データの読み込みに失敗しました。");
          }
        }
      } catch (err: any) {
        console.error("CalendarStrip load error:", err);
        setError("通信エラーが発生しました。");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId, date]);

  if (isLoading) {
    return (
      <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-40 h-20 bg-slate-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const handleReauth = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      window.location.reload(); 
    } catch (err) {
      console.error("Reauth failed:", err);
      setError("再ログインに失敗しました。");
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col space-y-2 py-2 px-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl border border-red-100 dark:border-red-900/30">
        <div className="flex items-start space-x-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="text-[10px] font-medium leading-tight">{error}</span>
        </div>
        {(error.includes("401") || error.includes("403") || error.includes("認証") || error.includes("連携が必要")) && (
          <button 
            onClick={handleReauth}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold transition-colors w-fit mt-1 shadow-sm"
          >
            <RefreshCw size={10} className={isLoading ? "animate-spin" : ""} />
            <span>Google連携を更新する</span>
          </button>
        )}
      </div>
    );
  }

  if (events.length === 0 && tasks.length === 0) {
    return (
      <div className="flex items-center space-x-2 py-2 px-4 bg-slate-50 dark:bg-zinc-900/30 text-slate-400 rounded-xl border border-slate-200 dark:border-zinc-800">
        <CalendarIcon size={14} />
        <span className="text-[10px] font-medium">今日の予定やタスクはありません</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {/* Calendar Events */}
        {events.map((event) => {
          const isFullDay = !event.start.includes("T");
          const startTime = isFullDay ? "終日" : format(new Date(event.start), "HH:mm");
          
          return (
            <div 
              key={event.id}
              className="flex-shrink-0 min-w-[160px] max-w-[200px] bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-1.5">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{startTime}</span>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {event.summary}
              </p>
            </div>
          );
        })}

        {/* Google Tasks */}
        {tasks.map((task) => (
          <div 
            key={task.id}
            className="flex-shrink-0 min-w-[160px] max-w-[200px] bg-amber-50/30 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 size={12} className="text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">Task</span>
              </div>
              <ListTodo size={12} className="text-amber-300 opacity-50" />
            </div>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {task.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
