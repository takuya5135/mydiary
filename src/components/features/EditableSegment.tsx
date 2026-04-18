import React, { useState, useEffect, useRef } from "react";
import { Edit2, Check, X } from "lucide-react";

interface EditableSegmentProps {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  theme: "home" | "work" | "hobby";
}

export function EditableSegment({ initialValue, onSave, placeholder, theme }: EditableSegmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="glass-card p-3 animate-in fade-in zoom-in-95 duration-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none min-h-[100px] leading-relaxed"
          placeholder={placeholder}
        />
        <div className="flex justify-end space-x-2 mt-2">
          <button 
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X size={16} />
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`p-1.5 rounded-md text-white transition-colors ${
              theme === "home" ? "bg-orange-500 hover:bg-orange-600" :
              theme === "work" ? "bg-blue-500 hover:bg-blue-600" :
              "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {isSaving ? <span className="text-[10px] px-1">...</span> : <Check size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="glass-card p-4 min-h-[60px]">
        {value ? (
          <ul className="space-y-2">
            {value.split('\n').filter(line => line.trim()).map((line, idx) => (
              <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start">
                <span className="mr-2 text-slate-400 mt-1.5 h-1 w-1 rounded-full bg-slate-300 flex-shrink-0" />
                <span className="leading-relaxed">{line.replace(/^[-\*\s・]+/, "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 italic opacity-50 py-2">
            データがありません
          </p>
        )}
      </div>
      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 dark:bg-zinc-800/80 shadow-sm border border-slate-200 dark:border-zinc-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-700 dark:hover:text-slate-200"
      >
        <Edit2 size={14} />
      </button>
    </div>
  );
}
