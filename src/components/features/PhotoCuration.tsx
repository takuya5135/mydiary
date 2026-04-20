"use client";

import React, { useState } from "react";
import { Image as ImageIcon, Plus, Trash2, Link } from "lucide-react";
import { saveDiaryEntry } from "@/lib/firebase/entries";

interface PhotoCurationProps {
  userId: string;
  date: string;
  selectedPhotoIds?: string[];
  onUpdate: () => void;
}

export function PhotoCuration({ userId, date, selectedPhotoIds = [], onUpdate }: PhotoCurationProps) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddPhoto = async () => {
    if (!photoUrl.trim()) return;
    setIsAdding(true);
    
    const newPhotos = [...selectedPhotoIds, photoUrl.trim()];
    
    try {
      await saveDiaryEntry({
        userId,
        date,
        photos: newPhotos
      });
      setPhotoUrl("");
      onUpdate();
    } catch (err) {
      console.error("Failed to add photo url:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePhoto = async (urlToRemove: string) => {
    const newPhotos = selectedPhotoIds.filter(url => url !== urlToRemove);
    try {
      await saveDiaryEntry({
        userId,
        date,
        photos: newPhotos
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to remove photo:", err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center">
          <ImageIcon size={14} className="mr-1.5 text-orange-500" />
          今日のフォト
        </h3>
        <span className="text-[10px] text-slate-400">{selectedPhotoIds.length}枚</span>
      </div>

      <div className="flex space-x-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Link size={14} className="text-slate-400" />
          </div>
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="画像のURLを貼り付け..."
            className="block w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          />
        </div>
        <button
          onClick={handleAddPhoto}
          disabled={!photoUrl.trim() || isAdding}
          className="flex-shrink-0 px-3 py-2 bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center justify-center font-bold text-xs"
        >
          {isAdding ? "追加中..." : <Plus size={16} />}
        </button>
      </div>

      {selectedPhotoIds.length > 0 && (
        <div className="mt-4 space-y-1.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
          {selectedPhotoIds.map((url, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50/80 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 group hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate mr-2"
                title={url}
              >
                <Link size={12} className="inline mr-1 opacity-70" />
                {url}
              </a>
              <button
                onClick={() => handleRemovePhoto(url)}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                title="削除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
