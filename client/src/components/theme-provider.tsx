import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

export type Palette = "teal" | "indigo" | "navy";

export const PALETTES: { id: Palette; label: string; swatch: string }[] = [
  { id: "teal", label: "Teal", swatch: "#17707B" },
  { id: "indigo", label: "Indigo", swatch: "#3B2FC4" },
  { id: "navy", label: "Navy", swatch: "#1D3159" },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultPalette?: Palette;
  storageKey?: string;
  paletteStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  palette: "teal",
  setPalette: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultPalette = "teal",
  storageKey = "startupvarsity-theme",
  paletteStorageKey = "startupvarsity-palette",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [palette, setPalette] = useState<Palette>(
    () => (localStorage.getItem(paletteStorageKey) as Palette) || defaultPalette
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Drives the [data-palette] blocks in index.css. Teal is the default and
  // needs no attribute, so it is cleared rather than stamped.
  useEffect(() => {
    const root = window.document.documentElement;

    if (palette === "teal") {
      root.removeAttribute("data-palette");
      return;
    }

    root.setAttribute("data-palette", palette);
  }, [palette]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    palette,
    setPalette: (palette: Palette) => {
      localStorage.setItem(paletteStorageKey, palette);
      setPalette(palette);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
