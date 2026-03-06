import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SunIcon, MoonIcon, ComputerDesktopIcon } from "@heroicons/react/24/outline";

type Theme = "light" | "system" | "dark";

const themes: { value: Theme; icon: typeof SunIcon; label: string }[] = [
  { value: "system", icon: ComputerDesktopIcon, label: "System" },
  { value: "light", icon: SunIcon, label: "Light" },
  { value: "dark", icon: MoonIcon, label: "Dark" },
];

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    // Initialize from localStorage
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ["light", "system", "dark"].includes(stored)) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      applyTheme("system");
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = localStorage.getItem("theme") as Theme | null;
      if (!current || current === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleSelect = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  return (
    <div
      className="relative flex w-fit items-center gap-1 rounded-lg bg-zinc-950/5 p-1 dark:bg-white/5"
      role="radiogroup"
      aria-label="Theme"
    >
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => handleSelect(value)}
          className="relative z-10 flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
        >
          {theme === value && (
            <motion.span
              layoutId="theme-indicator"
              className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-800 dark:ring-white/10"
              transition={{
                type: "spring",
                duration: 0.25,
                bounce: 0.15,
              }}
            />
          )}
          <Icon className="relative size-4" />
        </button>
      ))}
    </div>
  );
}
