"use client";

import React, { useState, useEffect } from "react";
import { Send, Mic, Sparkles, Loader2, Save } from "lucide-react";
import { DiaryEntry, getDiaryEntry, saveDiaryEntry } from "@/lib/firebase/entries";
import { executeHuddleAction } from "@/app/actions";

interface DiaryInputProps {
  userId: string;
  date: string;
  onSave?: (entry: DiaryEntry) => void;
  onHuddleTrigger?: () => void;
}

export function DiaryInput({ userId, date, onSave, onHuddleTrigger }: DiaryInputProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isHuddling, setIsHuddling] = useState(false);

  useEffect(() => {
    const fetchEntry = async () => {
      const entry = await getDiaryEntry(userId, date);
      if (entry) {
        setText(entry.rawText || "");
      } else {
        setText("");
      }
    };
    fetchEntry();
  }, [userId, date]);

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await saveDiaryEntry({
        userId,
        date,
        rawText: text
      });
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleHuddle = async () => {
    if (!text.trim() || isHuddling) return;
    
    setIsHuddling(true);
    if (onHuddleTrigger) onHuddleTrigger();

    try {
      const result = await executeHuddleAction(userId, date, text);
      if (result.success) {
        if (onSave) onSave(result.data as any);
      } else {
        alert("AI会議に失敗しました: " + result.error);
      }
    } catch (error) {
      console.error("Huddle execution error:", error);
    } finally {
      setIsHuddling(false);
    }
  };

  return (
    <div className="glass-panel p-4 flex flex-col space-y-3 bg-white/60 dark:bg-zinc-900/40">
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Raw Input / Record
        </label>
        <div className="flex items-center space-x-2">
          {isSaving && <span className="text-[10px] text-orange-500 animate-pulse">保存中...</span>}
          <button 
            onClick={handleManualSave}
            disabled={isSaving}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition-colors"
            title="手動保存"
          >
            <Save size={16} />
          </button>
        </div>
      </div>
      
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="今日はどんな一日でしたか？ 思ったことをダラダラと書き出してみましょう..."
        className="w-full h-32 bg-transparent text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none placeholder:text-slate-400 placeholder:italic leading-relaxed"
      />

      <div className="flex justify-between items-center pt-2">
        <button className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
          <Mic size={16} />
          <span>音声で入力</span>
        </button>

        <button 
          onClick={handleHuddle}
          disabled={!text.trim() || isHuddling}
          className="flex items-center space-x-2 px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-bold shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
        >
          {isHuddling ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          <span>Huddle (AI会議) を開始</span>
        </button>
      </div>
    </div>
  );
}
