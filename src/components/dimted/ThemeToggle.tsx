import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "dimted-theme";

function apply(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const next = stored === "light" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem(KEY, next);
  };

  const light = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={light}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      className={`border-border bg-secondary/50 hover:bg-secondary relative flex h-7 w-[52px] shrink-0 items-center rounded-full border px-1 transition-colors ${className}`}
    >
      <span
        className={`bg-background grid size-5 place-items-center rounded-full shadow transition-transform duration-300 ${
          light ? "translate-x-[24px]" : "translate-x-0"
        }`}
      >
        {light ? (
          <Sun className="text-gold size-3" strokeWidth={2.2} />
        ) : (
          <Moon className="text-primary size-3" strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}
