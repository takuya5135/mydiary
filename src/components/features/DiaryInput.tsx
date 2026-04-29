"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Mic, Sparkles, Loader2, Save } from "lucide-react";
import { DiaryEntry, getDiaryEntry, saveDiaryEntry, getRecentEntries } from "@/lib/firebase/entries";
import { getBucketList } from "@/lib/firebase/bucketList";
import { getDictionary, upsertDictionaryItem } from "@/lib/firebase/dictionary";
import { getUserProfile } from "@/lib/firebase/profile";
import { organizeDiaryAction } from "@/app/actions";
import { DictionarySuggestion } from "@/lib/ai/huddle";
import { BookPlus, CheckCircle, Plus } from "lucide-react";

interface DiaryInputProps {
  userId: string;
  date: string;
  onSave?: (entry: DiaryEntry) => void;
  onOrganizeTrigger?: () => void;
}

export function DiaryInput({ userId, date, onSave, onOrganizeTrigger }: DiaryInputProps) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [suggestions, setSuggestions] = useState<DictionarySuggestion[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // 音声認識の初期化
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false; // 確定した結果のみを取得
        recognitionRef.current.lang = "ja-JP";

        recognitionRef.current.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setText(prev => {
              const currentText = prev.trim();
              const separator = currentText ? "\n" : "";
              return currentText + separator + transcript;
            });
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
        };
      }
    }
  }, []);

  const handleMicStart = () => {
    if (recognitionRef.current && !isRecording) {
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start recognition:", err);
        setIsRecording(false);
      }
    }
  };

  const handleMicEnd = () => {
    if (recognitionRef.current && isRecording) {
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await saveDiaryEntry({
        userId,
        date,
        rawText: text
      });
      
      // Fire and forget routing update (サイレント・インデックス)
      fetch("/api/entries/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, date, text })
      }).catch(err => console.error("AutoRouting fetch error:", err));

      // 保存したあと親のStateを更新させる
      const current = await getDiaryEntry(userId, date);
      if (current && onSave) onSave(current);
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrganize = async () => {
    if (!text.trim() || isOrganizing) return;
    
    setIsOrganizing(true);
    if (onOrganizeTrigger) onOrganizeTrigger();

    try {
      // 1. クライアント側でFirebaseからコンテキスト情報を取得
      const [dictionary] = await Promise.all([
        getDictionary(userId),
      ]);

      const dictionaryContext = dictionary
        .map(item => `- ${item.name} (${item.aliases.join(", ")}): ${item.attributes?.memo || ""}`)
        .join("\n");

      // Google Token の取得 (カレンダー連携のため)
      // @ts-ignore
      const { getUserToken } = await import("@/lib/firebase/tokens");
      const googleToken = await getUserToken(userId);

      // 3. Server ActionでGemini API呼び出し
      const result = await organizeDiaryAction(userId, text, {
        dictionaryContext,
      }, googleToken || null, date);

      if (result.success) {
        // 4. クライアント側でFirestoreに保存
        await saveDiaryEntry({
          userId,
          date,
          rawText: text,
          segments: result.data,
          keywords: result.data.keywords, // キーワードを保存
          embedding: result.embedding, // ベクトルデータを保存
        });
        
        // Fire and forget routing update (サイレント・インデックス)
        fetch("/api/entries/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, date, text })
        }).catch(err => console.error("AutoRouting fetch error:", err));
        
        // 4.5 提案をセット
        if (result.data.dictionarySuggestions && result.data.dictionarySuggestions.length > 0) {
          setSuggestions(result.data.dictionarySuggestions);
          setRegisteredIds(new Set());
        } else {
          setSuggestions([]);
        }

        // 5. 更新を親コンポーネントに通知
        const updatedEntry = await getDiaryEntry(userId, date);
        if (updatedEntry && onSave) onSave(updatedEntry);

      } else {
        alert("整理に失敗しました:\n\n" + result.error);
      }
    } catch (error) {
      console.error("Organize execution error:", error);
      alert("通信エラーが発生しました");
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleRegisterSuggestion = async (suggestion: DictionarySuggestion, index: number) => {
    try {
      await upsertDictionaryItem(userId, {
        name: suggestion.name,
        category: suggestion.category,
        aliases: [],
        attributes: {
          memo: suggestion.memo
        }
      });
      setRegisteredIds(prev => new Set([...prev, suggestion.name]));
    } catch (error) {
      console.error("Suggestion registration failed:", error);
      alert("登録に失敗しました");
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
        className="w-full bg-transparent text-lg md:text-xl text-slate-700 dark:text-slate-200 resize-none focus:outline-none placeholder:text-slate-400 placeholder:italic leading-relaxed min-h-[300px] overflow-hidden"
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = "auto";
          target.style.height = target.scrollHeight + "px";
        }}
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }
        }}
      />

      <div className="flex justify-between items-center pt-2">
        <button 
          onMouseDown={handleMicStart}
          onMouseUp={handleMicEnd}
          onMouseLeave={handleMicEnd}
          onTouchStart={(e) => { e.preventDefault(); handleMicStart(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleMicEnd(); }}
          className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            isRecording 
              ? "bg-red-500 text-white scale-105 animate-pulse ring-4 ring-red-500/20 shadow-lg shadow-red-500/20" 
              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
          }`}
          title="音声で入力（押している間は録音）"
        >
          <Mic size={16} className={isRecording ? "animate-bounce" : ""} />
          <span>{isRecording ? "録音中..." : "音声で入力"}</span>
        </button>

        <button 
          onClick={handleOrganize}
          disabled={!text.trim() || isOrganizing}
          className="flex items-center space-x-2 px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-bold shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
        >
          {isOrganizing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          <span>AIで日記を整理・構造化</span>
        </button>
      </div>

      {/* --- DICTIONARY SUGGESTIONS --- */}
      {suggestions.length > 0 && (
        <div className="mt-4 p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2 mb-3">
            <BookPlus size={14} className="text-orange-500" />
            <h3 className="text-[10px] font-black tracking-widest text-orange-600 dark:text-orange-400 uppercase">AI Dictionary Suggestions</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => {
              const isRegistered = registeredIds.has(suggestion.name);
              return (
                <button
                  key={idx}
                  onClick={() => !isRegistered && handleRegisterSuggestion(suggestion, idx)}
                  disabled={isRegistered}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    isRegistered 
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                      : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 border border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 shadow-sm"
                  }`}
                >
                  <span className="opacity-60">{suggestion.category === 'person' ? '👤' : suggestion.category === 'place' ? '📍' : suggestion.category === 'organization' ? '🏢' : '🏷️'}</span>
                  <span>{suggestion.name}</span>
                  {isRegistered ? <CheckCircle size={12} /> : <Plus size={12} className="text-orange-500" />}
                </button>
              );
            })}
            <button 
              onClick={() => setSuggestions([])}
              className="px-2 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              閉じる
            </button>
          </div>
          <p className="text-[9px] text-orange-400 mt-2 ml-1">※AIが未登録の重要語句を見つけました。クリックすると辞書に登録されます。</p>
        </div>
      )}
    </div>
  );
}
