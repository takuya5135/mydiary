import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { fetchDailyCalendarEvents, CalendarEvent } from "@/lib/google/calendar";
import { getUserToken } from "@/lib/firebase/tokens";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface CalendarStripProps {
  userId: string;
  date: string; // YYYY-MM-DD
}

export function CalendarStrip({ userId, date }: CalendarStripProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getUserToken(userId);
        if (!token) {
          setError("Google連携が必要です。再ログインをお試しください。");
          return;
        }
        const fetchedEvents = await fetchDailyCalendarEvents(token, date);
        setEvents(fetchedEvents);
      } catch (err: any) {
        console.error("CalendarStrip load error:", err);
        setError("予定の読み込みに失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [userId, date]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 py-3 px-4 bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-slate-200 dark:border-zinc-800 animate-pulse">
        <div className="w-4 h-4 bg-slate-200 dark:bg-zinc-700 rounded-full" />
        <div className="h-3 w-32 bg-slate-200 dark:bg-zinc-700 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 py-2 px-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl border border-red-100 dark:border-red-900/30">
        <AlertCircle size={14} />
        <span className="text-[10px] font-medium">{error}</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center space-x-2 py-2 px-4 bg-slate-50 dark:bg-zinc-900/30 text-slate-400 rounded-xl border border-slate-200 dark:border-zinc-800">
        <CalendarIcon size={14} />
        <span className="text-[10px] font-medium">今日の予定はありません</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2 px-1">
        <CalendarIcon size={14} className="text-blue-500" />
        <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Today's Schedule</h3>
      </div>
      <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide">
        {events.map((event) => {
          const startTime = event.start ? format(new Date(event.start), "HH:mm") : "終日";
          return (
            <div 
              key={event.id}
              className="flex-shrink-0 min-w-[160px] max-w-[200px] bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <Clock size={12} className="text-blue-400" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{startTime}</span>
              </div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                {event.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
