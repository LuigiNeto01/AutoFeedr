const THEME_KEY = "autofeedr_theme";

export function getSavedTheme() {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

export function saveTheme(theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
}
