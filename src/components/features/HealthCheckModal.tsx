"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Sun, Moon, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { saveDiaryEntry, DiaryEntry } from "@/lib/firebase/entries";

interface HealthCheckModalProps {
  userId: string;
  date: string;
  type: "morning" | "evening" | null;
  currentData: NonNullable<DiaryEntry["healthData"]>[keyof NonNullable<DiaryEntry["healthData"]>];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function HealthCheckModal({ userId, date, type, currentData, isOpen, onClose, onSaved }: HealthCheckModalProps) {
  const [comment, setComment] = useState("");
  const [weight, setWeight] = useState("");
  const [bp, setBp] = useState("");
  const [sleep, setSleep] = useState("");
  const [meds, setMeds] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setComment(currentData?.comment || "");
      setWeight(currentData?.weight ? String(currentData.weight) : "");
      setBp(currentData?.bloodPressure || "");
      setSleep(currentData && 'sleepHours' in currentData && currentData.sleepHours ? String(currentData.sleepHours) : "");
      setMeds(currentData?.medsCompleted || false);
    }
  }, [isOpen, currentData]);

  const handleSave = async () => {
    if (!type) return;
    setSaving(true);
    
    try {
      const dataToSave = {
        comment,
        weight: weight ? parseFloat(weight) : undefined,
        bloodPressure: bp,
        medsCompleted: meds,
        ...(type === "morning" && { sleepHours: sleep ? parseFloat(sleep) : undefined }),
      };

      // healthDataの部分更新を行う
      const { getDiaryEntry } = await import("@/lib/firebase/entries");
      const currentEntry = await getDiaryEntry(userId, date);
      const newHealthData = {
        ...(currentEntry?.healthData || {}),
        [type]: dataToSave
      };

      await saveDiaryEntry({
        userId,
        date,
        healthData: newHealthData
      });
      onSaved();
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const isMorning = type === "morning";

  return (
    <AnimatePresence>
      {isOpen && type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className={`relative w-full max-w-md p-6 overflow-hidden shadow-2xl rounded-3xl border ${isMorning ? 'bg-orange-50/95 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50' : 'bg-indigo-50/95 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50'} backdrop-blur-md`}
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-black/10 rounded-full text-slate-500"
            >
              <X size={20} />
            </button>

            <div className={`flex items-center space-x-3 mb-6 ${isMorning ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {isMorning ? <Sun size={24} /> : <Moon size={24} />}
              <h2 className="text-xl font-bold">{isMorning ? 'おはようチェック' : 'おやすみチェック'}</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">今の気分・体調メモ</label>
                <textarea 
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 resize-none h-20 text-sm"
                  placeholder="よく眠れた、頭が痛い、がんばるぞ等"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">体重 (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="w-full bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:outline-none text-sm"
                    placeholder="65.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">血圧 (上/下)</label>
                  <input 
                    type="text"
                    value={bp}
                    onChange={e => setBp(e.target.value)}
                    className="w-full bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:outline-none text-sm"
                    placeholder="120/80"
                  />
                </div>
                {isMorning && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">睡眠時間 (h)</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={sleep}
                      onChange={e => setSleep(e.target.value)}
                      className="w-full bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-800 dark:text-white focus:outline-none text-sm"
                      placeholder="7.5"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/30 transition-colors">
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={meds}
                    onChange={e => setMeds(e.target.checked)}
                  />
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${meds ? 'border-green-500 bg-green-500' : 'border-slate-400'}`}>
                    {meds && <CheckCircle2 size={16} className="text-white" />}
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">常用薬・サプリメントを飲んだ</span>
                </label>
              </div>

              <div className="mt-8">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${isMorning ? 'bg-orange-500 flex-hover:bg-orange-600 shadow-orange-500/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'}`}
                >
                  {saving ? "保存中..." : "記録する"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
