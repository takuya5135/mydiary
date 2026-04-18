"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { 
  Home, Briefcase, Heart, Sun, Moon, ShieldCheck, CheckCircle2, Trophy, Plus, LogOut, 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Book, CloudUpload
} from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";
import { Column } from "@/components/layout/Column";
import { logout } from "@/lib/firebase/auth";
import { BucketListModal } from "@/components/features/BucketListModal";
import { DictionaryModal } from "@/components/features/DictionaryModal";
import { ProfileModal } from "@/components/features/ProfileModal";
import { HealthCheckModal } from "@/components/features/HealthCheckModal";
import { PhotoCuration } from "@/components/features/PhotoCuration";
import { DiaryInput } from "@/components/features/DiaryInput";
import { DiaryEntry, getDiaryEntry } from "@/lib/firebase/entries";
import { backupToDriveAction } from "@/app/actions";

export default function HomeView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false);
  const [isDictModalOpen, setIsDictModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [healthModalType, setHealthModalType] = useState<"morning" | "evening" | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [entry, setEntry] = useState<DiaryEntry | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

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

  if (loading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
  };

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // 1分ごとに現在時刻を更新
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isToday = now ? isSameDay(selectedDate, now) : false;

  const handleHealthCheckClick = (type: 'morning' | 'evening') => {
    setHealthModalType(type);
  };

  return (
    <main className="h-screen w-full p-4 md:p-6 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900 flex flex-col">
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 px-2 gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center mr-6">
            my日記 <span className="ml-3 text-xs font-normal text-slate-500 bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">v1.1.2</span>
          </h1>
          
          <div className="flex items-center space-x-1 bg-white dark:bg-zinc-900 rounded-xl px-2 py-1 border border-slate-200 dark:border-zinc-800 shadow-sm">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-500"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center space-x-2 px-3">
              <CalendarIcon size={16} className="text-orange-500" />
              <span className="text-sm font-bold min-w-[120px] text-center">
                {format(selectedDate, "yyyy年MM月dd日 (eee)", { locale: ja })}
              </span>
              {!isToday && (
                <button 
                  onClick={() => setSelectedDate(new Date())}
                  className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 px-1.5 py-0.5 rounded font-bold hover:bg-orange-200 transition-colors"
                >
                  今日
                </button>
              )}
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-500"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={handleBackup}
            disabled={isBackingUp || !entry}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
              isBackingUp 
                ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 border-slate-200" 
                : "bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            }`}
          >
            <CloudUpload size={16} className={isBackingUp ? "animate-pulse" : ""} />
            <span>{isBackingUp ? "保存中..." : "Drive保存"}</span>
          </button>

          <button 
            onClick={() => setIsDictModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-bold"
          >
            <Book size={16} className="text-orange-500" />
            <span>固有名詞辞書</span>
          </button>
          
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center space-x-2 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors rounded-full pl-1 pr-3 py-1 border border-slate-200 dark:border-zinc-800 shadow-sm ml-2 cursor-pointer"
          >
            <img src={user.photoURL || ""} alt="" className="w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-700" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.displayName}</span>
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] w-full mx-auto mb-4 px-2">
        <DiaryInput 
          userId={user.uid} 
          date={dateStr} 
          onSave={fetchEntry}
        />
      </div>

      {/* --- LIFE BAR (バケットリスト) --- */}
      <div className="max-w-[1600px] w-full mx-auto mb-4 px-2">
        <div
          onClick={() => setIsBucketModalOpen(true)}
          className="w-full cursor-pointer group flex items-center justify-between px-6 py-4 rounded-2xl border border-amber-200/60 dark:border-amber-700/40 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/40 shadow-md hover:shadow-lg hover:scale-[1.005] transition-all"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-amber-100 dark:bg-amber-900/60 p-3 rounded-xl text-amber-600 dark:text-amber-400 shadow-inner">
              <Trophy size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-amber-500 dark:text-amber-400 uppercase mb-0.5">Life</p>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">死ぬまでにやりたいことリスト</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Home・Work・Hobby すべてを超えた、あなたの人生の目標</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-3 py-1 rounded-full hidden md:block">クリックして確認・編集</span>
            <Plus size={22} className="text-amber-400 group-hover:text-amber-600 transition-transform group-hover:rotate-90" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
        
        {/* --- HOME COLUMN --- */}
        <Column
          id="home"
          title="Home"
          icon={<Home size={28} />}
          className="animate-slide-up"
          style={{ animationDelay: '0.1s', animationFillMode: 'both' }}
        >
          {/* Health Check Cards */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button 
              onClick={() => handleHealthCheckClick('morning')}
              className={`glass-card flex flex-col items-center justify-center p-4 group transition-all hover:scale-[1.02] ${
                entry?.healthData?.morning 
                  ? "bg-orange-500/20 border-orange-500/50 text-orange-600 dark:text-orange-400 shadow-lg shadow-orange-500/10" 
                  : "text-slate-400 hover:text-orange-400"
              }`}
            >
              <Sun size={32} className={`mb-2 transition-transform ${entry?.healthData?.morning ? "scale-110" : "group-hover:scale-110"}`} />
              <div className="flex items-center space-x-1">
                <span className="font-bold text-sm">おはよう</span>
                {entry?.healthData?.morning && <CheckCircle2 size={14} className="text-orange-500" />}
              </div>
            </button>
            <button 
              onClick={() => handleHealthCheckClick('evening')}
              className={`glass-card flex flex-col items-center justify-center p-4 group transition-all hover:scale-[1.02] ${
                entry?.healthData?.evening 
                  ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/10" 
                  : "text-slate-400 hover:text-indigo-400"
              }`}
            >
              <Moon size={32} className={`mb-2 transition-transform ${entry?.healthData?.evening ? "scale-110" : "group-hover:scale-110"}`} />
              <div className="flex items-center space-x-1">
                <span className="font-bold text-sm">おやすみ</span>
                {entry?.healthData?.evening && <CheckCircle2 size={14} className="text-indigo-500" />}
              </div>
            </button>
          </div>

          <div className="glass-card p-4 relative overflow-hidden animate-float">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full" />
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full text-blue-600 dark:text-blue-400 mt-1">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center">
                  マモの報告 (リスク管理者)
                  <span className={`ml-2 w-2 h-2 rounded-full ${entry?.responses?.c2 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-300 animate-pulse"}`} />
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                  {entry?.responses?.c2 || "Huddleを開始すると、マモがリスクを分析します。"}
                </p>
              </div>
            </div>
          </div>

          {entry?.segments?.home && (
            <div className="glass-card p-4 space-y-2 mt-4 border-l-4 border-l-orange-400">
              <div className="flex items-center text-[10px] font-bold text-slate-500 mb-1">
                <CheckCircle2 size={12} className="mr-1 text-green-500" />
                LOG (C1) による整理
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {entry?.segments?.home}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-4">
            <PhotoCuration 
              userId={user.uid} 
              date={dateStr} 
              selectedPhotoIds={entry?.photos || []}
              onUpdate={fetchEntry} 
            />
          </div>
        </Column>

        {/* --- WORK COLUMN --- */}
        <Column
          id="work"
          title="Work"
          icon={<Briefcase size={28} />}
          className="animate-slide-up"
          style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
        >
           {entry?.segments?.work && (
            <div className="glass-card p-4 border-l-4 border-l-blue-400">
               <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {entry?.segments?.work}
              </p>
            </div>
           )}

           {entry?.responses?.c4 && (
             <div className="mt-4 p-4 border-l-4 border-l-slate-400 glass-card animate-float">
                <div className="flex items-center space-x-2 mb-2 text-slate-600 dark:text-slate-400">
                  <ShieldCheck size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">ZEN (大軍師)</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                  {entry?.responses?.c4}
                </p>
             </div>
           )}

           {!entry?.segments?.work && !entry?.responses?.c4 && (
             <div className="py-20 text-center text-slate-400 text-sm italic opacity-50">Workに関するデータはありません</div>
           )}
        </Column>

        {/* --- HOBBY COLUMN --- */}
        <Column
          id="hobby"
          title="Hobby"
          icon={<Heart size={28} />}
          className="animate-slide-up"
          style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
        >
           {entry?.segments?.hobby && (
            <div className="glass-card p-4 mt-4 border-l-4 border-l-emerald-400">
               <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {entry?.segments?.hobby}
              </p>
            </div>
           )}

           {entry?.responses?.c3 && (
             <div className="mt-4 p-4 border-l-4 border-l-emerald-400 glass-card animate-float">
                <div className="flex items-center space-x-2 mb-2 text-emerald-600 dark:text-emerald-400">
                  <Heart size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">WAKU (トレーナー)</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  {entry?.responses?.c3}
                </p>
             </div>
           )}

           {!entry?.segments?.hobby && !entry?.responses?.c3 && (
             <div className="py-20 text-center text-slate-400 text-sm italic opacity-50">Hobbyに関するデータはありません</div>
           )}
        </Column>
      </div>

      <BucketListModal 
        userId={user.uid} 
        isOpen={isBucketModalOpen} 
        onClose={() => setIsBucketModalOpen(false)} 
      />
      <DictionaryModal 
        userId={user.uid} 
        isOpen={isDictModalOpen} 
        onClose={() => setIsDictModalOpen(false)} 
      />
      <ProfileModal 
        userId={user.uid} 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
      <HealthCheckModal 
        userId={user.uid}
        date={dateStr}
        type={healthModalType}
        currentData={healthModalType ? entry?.healthData?.[healthModalType] : undefined}
        isOpen={healthModalType !== null}
        onClose={() => setHealthModalType(null)}
        onSaved={fetchEntry}
      />
    </main>
  );
}
