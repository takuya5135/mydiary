"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
  Home, Briefcase, Heart, Sun, Moon, Trophy, Plus, LogOut, CheckCircle2,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Book, CloudUpload,
  CalendarDays, Search
} from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Column } from "@/components/layout/Column";
import { logout } from "@/lib/firebase/auth";
import { BucketListModal } from "@/components/features/BucketListModal";
import { DictionaryModal } from "@/components/features/DictionaryModal";
import { SearchModal } from "@/components/features/SearchModal";
import { ProfileModal } from "@/components/features/ProfileModal";
import { HealthCheckModal } from "@/components/features/HealthCheckModal";
import { PhotoCuration } from "@/components/features/PhotoCuration";
import { DiaryInput } from "@/components/features/DiaryInput";
import { EditableSegment } from "@/components/features/EditableSegment";
import { CalendarStrip } from "@/components/features/CalendarStrip";
import { ChatWindow } from "@/components/features/ChatWindow";
import { DiaryEntry, getDiaryEntry, saveDiaryEntry } from "@/lib/firebase/entries";
import { backupToDriveAction } from "@/app/actions";

export default function HomeView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [isDictModalOpen, setIsDictModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [healthModalType, setHealthModalType] = useState<"morning" | "evening" | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  
  const dateInputRef = useRef<HTMLInputElement>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (code && user) {
      handleGoogleAuthCallback(code);
    }
  }, [code, user]);

  const handleGoogleAuthCallback = async (authCode: string) => {
    if (!user) return;
    try {
      const { exchangeAuthCodeAction } = await import("@/app/actions");
      const { saveUserToken } = await import("@/lib/firebase/tokens");
      
      const result = await exchangeAuthCodeAction(
        user.uid,
        authCode,
        window.location.origin,
        user.email
      );

      if (result.success) {
        await saveUserToken(
          user.uid,
          result.accessToken,
          // @ts-ignore
          result.refreshToken,
          user.email
        );
        // URLをクリーンアップ
        router.replace("/");
        setTimeout(() => alert("Google連携が正常に完了しました！"), 500);
      } else {
        console.error("Auth callback failed:", result.error);
        alert("Google連携に失敗しました: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。");
    }
  };

  const handleBackup = async () => {
    if (!user || !entry) return;
    setIsBackingUp(true);

    try {
      // @ts-ignore
      const { getUserToken } = await import("@/lib/firebase/tokens");
      const token = await getUserToken(user.uid);
      if (!token) {
        alert("Google認証情報を取得できませんでした。再度ログインしてください。");
        setIsBackingUp(false);
        return;
      }

      const mdContent = `
# ${dateStr} (my日記)

## 記録内容
### Home
${entry.segments?.home || "なし"}

### Work
${entry.segments?.work || "なし"}

### Hobby
${entry.segments?.hobby || "なし"}

## 原文
${entry.rawText}

---
Updated at: ${entry.updatedAt ? entry.updatedAt.toDate().toLocaleString() : "不明"}
`.trim();

      const fileName = `${dateStr}_diary.md`;
      const result = await backupToDriveAction(token, fileName, mdContent);
      
      if (result.success) {
        alert("Google Driveへのバックアップが完了しました！");
      } else {
        alert("バックアップに失敗しました: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("予期しない通信エラーが発生しました。");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
    }
  };

  const triggerDatePicker = () => {
    if (dateInputRef.current) {
      // @ts-ignore
      if (typeof dateInputRef.current.showPicker === 'function') {
        // @ts-ignore
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.click();
      }
    }
  };

  const handleDateChange = (newDateStr: string) => {
    const newDate = new Date(newDateStr);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchEntry();
    }
  }, [user, dateStr]);

  const fetchEntry = async () => {
    if (!user) return;
    const data = await getDiaryEntry(user.uid, dateStr);
    setEntry(data);
  };

  const handleLogout = async () => {
    await logout();
  };

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isToday = now ? isSameDay(selectedDate, now) : false;

  const handleHealthCheckClick = (type: 'morning' | 'evening') => {
    setHealthModalType(type);
  };

  const handleSaveSegment = async (theme: 'home' | 'work' | 'hobby', value: string) => {
    if (!user || !entry) return;
    const newSegments = {
      ...(entry.segments || { home: "", work: "", hobby: "" }),
      [theme]: value
    };
    await saveDiaryEntry({
      userId: user.uid,
      date: dateStr,
      // @ts-ignore
      segments: newSegments
    });
    fetchEntry();
  };

  if (loading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900 flex flex-col pb-10">
      <header className="sticky top-0 z-50 bg-white/10 backdrop-blur-md border-b border-slate-200/50 dark:border-zinc-800/50 flex flex-col md:flex-row justify-between items-center py-4 px-4 md:px-8 gap-4 mb-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center mr-6">
            my日記 <span className="ml-3 text-[10px] font-normal text-slate-500 bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">v3.0</span>
          </h1>
          
          <div className="flex items-center space-x-1 bg-white dark:bg-zinc-900 rounded-xl px-1 py-1 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-500"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="relative flex items-center">
              <input 
                ref={dateInputRef}
                type="date" 
                className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none" 
                onChange={handleDateSelect}
                value={dateStr}
              />
              <button 
                onClick={triggerDatePicker}
                className="flex items-center space-x-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-all group"
              >
                <CalendarDays size={16} className="text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold min-w-[120px] text-center text-slate-700 dark:text-slate-200">
                  {format(selectedDate, "yyyy年MM月dd日 (eee)", { locale: ja })}
                </span>
                {isToday && (
                  <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold">今日</span>
                )}
              </button>
            </div>

            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-500"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3 overflow-x-auto max-w-full pb-2 md:pb-0">
          <button 
            onClick={handleBackup}
            disabled={isBackingUp || !entry}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <CloudUpload size={16} className={isBackingUp ? "animate-pulse" : ""} />
            <span className="btn-text-fix">{isBackingUp ? "保存中..." : "Drive保存"}</span>
          </button>

          <button 
            onClick={() => setIsBucketModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Trophy size={16} />
            <span className="btn-text-fix">バケットリスト</span>
          </button>

          <button 
            onClick={() => setIsDictModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-bold"
          >
            <Book size={16} className="text-orange-500" />
            <span className="btn-text-fix">ナレッジ・ベース</span>
          </button>

          <button 
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-xs font-bold shadow-sm"
          >
            <Search size={16} className="text-blue-500" />
            <span className="btn-text-fix">検索</span>
          </button>
          
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center space-x-2 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors rounded-full pl-1 pr-4 py-1 border border-slate-200 dark:border-zinc-800 shadow-sm ml-2"
          >
            <img src={user.photoURL || ""} alt="" className="w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-700" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 btn-text-fix">{user.displayName}</span>
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="main-layout flex flex-col md:flex-row">
        <aside className="left-pane animate-slide-up">
          <div className="sticky top-28 space-y-6">
            <DiaryInput 
              userId={user.uid} 
              date={dateStr} 
              onSave={fetchEntry}
            />
            
            <div className="glass-panel p-6">
              <div className="flex items-center space-x-3 mb-4">
                <CalendarIcon size={20} className="text-orange-500" />
                <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">今日の予定とタスク</h3>
              </div>
              <div className="space-y-1">
                {user && <CalendarStrip userId={user.uid} date={dateStr} />}
              </div>
            </div>
          </div>
        </aside>

        <section className="right-pane">
          <div className="space-y-6">
            <div className="glass-panel p-6 animate-slide-up">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                  <span className="text-xl">📸</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Daily Highlights</h3>
                  <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">その日の空気感を象徴する断片</p>
                </div>
              </div>
              <PhotoCuration 
                userId={user.uid} 
                date={dateStr} 
                selectedPhotoIds={entry?.photos || []}
                onUpdate={fetchEntry} 
              />
            </div>

            <Column id="home" title="Home" icon={<Home size={28} />}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button 
                  onClick={() => handleHealthCheckClick('morning')}
                  className={`glass-card flex flex-col items-center justify-center p-6 group transition-all hover:scale-[1.02] ${
                    entry?.healthData?.morning ? "bg-orange-500/10 border-orange-500/30" : ""
                  }`}
                >
                  <Sun size={32} className={`mb-2 ${entry?.healthData?.morning ? "text-orange-500" : "text-slate-300"}`} />
                  <span className="font-bold text-sm">おはよう</span>
                </button>
                <button 
                  onClick={() => handleHealthCheckClick('evening')}
                  className={`glass-card flex flex-col items-center justify-center p-6 group transition-all hover:scale-[1.02] ${
                    entry?.healthData?.evening ? "bg-indigo-500/10 border-indigo-500/30" : ""
                  }`}
                >
                  <Moon size={32} className={`mb-2 ${entry?.healthData?.evening ? "text-indigo-500" : "text-slate-300"}`} />
                  <span className="font-bold text-sm">おやすみ</span>
                </button>
              </div>

              {entry?.segments?.home && (
                <div className="mt-4 border-l-4 border-l-orange-400 pl-4 bg-orange-50/20 dark:bg-orange-950/10 py-2 rounded-r-xl">
                  <EditableSegment 
                    theme="home"
                    initialValue={entry.segments.home} 
                    onSave={(val) => handleSaveSegment('home', val)} 
                  />
                </div>
              )}
            </Column>

            <Column id="work" title="Work" icon={<Briefcase size={28} />}>
               {entry?.segments?.work ? (
                <div className="mt-4 border-l-4 border-l-blue-400 pl-4 bg-blue-50/20 dark:bg-blue-950/10 py-2 rounded-r-xl">
                  <EditableSegment 
                    theme="work"
                    initialValue={entry.segments.work} 
                    onSave={(val) => handleSaveSegment('work', val)} 
                  />
                </div>
               ) : (
                 <div className="py-12 text-center text-slate-300 dark:text-zinc-600 text-sm italic">Workの記録はありません</div>
               )}
            </Column>

            <Column id="hobby" title="Hobby" icon={<Heart size={28} />}>
               {entry?.segments?.hobby ? (
                <div className="mt-4 border-l-4 border-l-emerald-400 pl-4 bg-emerald-50/20 dark:bg-emerald-950/10 py-2 rounded-r-xl">
                  <EditableSegment 
                    theme="hobby"
                    initialValue={entry.segments.hobby} 
                    onSave={(val) => handleSaveSegment('hobby', val)} 
                  />
                </div>
               ) : (
                 <div className="py-12 text-center text-slate-300 dark:text-zinc-600 text-sm italic">Hobbyの記録はありません</div>
               )}
            </Column>
          </div>
        </section>
      </div>

      <BucketListModal userId={user.uid} isOpen={isBucketModalOpen} onClose={() => setIsBucketModalOpen(false)} />
      <DictionaryModal userId={user.uid} isOpen={isDictModalOpen} onClose={() => setIsDictModalOpen(false)} />
      <SearchModal userId={user.uid} isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} onDateChange={handleDateChange} />
      <ProfileModal userId={user.uid} isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <HealthCheckModal 
        userId={user.uid} date={dateStr} type={healthModalType}
        currentData={healthModalType ? entry?.healthData?.[healthModalType] : undefined}
        isOpen={healthModalType !== null} onClose={() => setHealthModalType(null)} onSaved={fetchEntry}
      />
      <ChatWindow userId={user.uid} dateStr={dateStr} onDateChange={handleDateChange} />
    </main>
  );
}
