import { Moon, Sun, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isDark, setIsDark] = useState(false);

  // Determine if dark mode is active - check DOM state which is the source of truth
  useEffect(() => {
    const updateIsDark = () => {
      const root = window.document.documentElement;
      const isDarkMode = root.classList.contains("dark");
      setIsDark(isDarkMode);
    };

    // Initial check
    updateIsDark();

    // Listen for DOM changes to catch theme updates
    const observer = new MutationObserver(() => {
      updateIsDark();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // If theme is "system", also listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        // Small delay to let DOM update
        setTimeout(updateIsDark, 10);
      };
      mediaQuery.addEventListener("change", handleChange);
      
      return () => {
        observer.disconnect();
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    return () => observer.disconnect();
  }, [theme]);

  const handleToggle = (checked: boolean) => {
    // Immediately update local state for instant UI feedback
    setIsDark(checked);
    
    // Update theme in provider
    if (checked) {
      setTheme("dark");
    } else {
      setTheme("light");
    }
    
    // Also ensure DOM is updated (fallback)
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(checked ? "dark" : "light");
  };

  return (
    <div className="flex items-center gap-2.5 px-1">
      {/* Sun Icon */}
      <Sun 
        className={`h-5 w-5 transition-all duration-300 ${
          isDark ? 'text-muted-foreground/60' : 'text-foreground'
        }`} 
        strokeWidth={1.5}
      />
      
      {/* Custom Toggle Switch */}
      <div className="relative">
        <Switch
          checked={isDark}
          onCheckedChange={handleToggle}
          className="h-7 w-14 data-[state=checked]:bg-muted data-[state=unchecked]:bg-muted/80 shadow-inner"
        />
      </div>
      
      {/* Moon with Stars Icon */}
      <div className="relative h-5 w-5">
        <Moon 
          className={`h-5 w-5 transition-all duration-300 ${
            isDark ? 'text-foreground' : 'text-muted-foreground/60'
          }`} 
          strokeWidth={1.5}
        />
        {/* Stars next to moon */}
        <div className="absolute -top-0.5 -right-1 flex items-start gap-0.5">
          <Star 
            className={`h-2.5 w-2.5 transition-all duration-300 ${
              isDark ? 'text-foreground fill-foreground/40' : 'text-muted-foreground/40 fill-transparent'
            }`} 
            strokeWidth={1.5}
          />
          <Star 
            className={`h-2 w-2 transition-all duration-300 mt-0.5 ${
              isDark ? 'text-foreground fill-foreground/30' : 'text-muted-foreground/40 fill-transparent'
            }`} 
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}