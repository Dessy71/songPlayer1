import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('gyidi-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch { /* Storage can be unavailable in private browsing. */ }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');
    try { localStorage.setItem('gyidi-theme', theme); } catch { /* Keep the toggle usable. */ }
  }, [theme]);
  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  return (
    <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={label} title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 cursor-pointer">
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
