import { clsx } from "clsx";
import { ReactNode } from "react";

interface ColumnProps {
  id: "home" | "work" | "hobby";
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Column({
  id,
  title,
  icon,
  children,
  className,
  style,
}: ColumnProps) {
  return (
    <section
      className={clsx(
        "flex flex-col h-full rounded-3xl overflow-hidden glass-panel border-t-4 shadow-2xl transition-all",
        id === "home" && "theme-home",
        id === "work" && "theme-work",
        id === "hobby" && "theme-hobby",
        className
      )}
      style={{
        borderColor: `var(--color-${id}-ring)`,
        ...style,
      }}
    >
      <header className="px-6 py-5 flex items-center space-x-3 bg-white/40 dark:bg-black/20 backdrop-blur-sm border-b border-white/20 dark:border-zinc-800/50 object-cover">
        <div style={{ color: `var(--color-${id}-ring)` }}>{icon}</div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {children}
      </div>
    </section>
  );
}
