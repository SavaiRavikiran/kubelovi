import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, User, Eye, EyeOff, LogIn, Moon, Sun } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import novartisLogo from '@/images/novartis-logo.png';

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { toast } = useToast();

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  // Check for saved theme preference or use system preference
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onLogin(username, password);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="w-full max-w-md space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex items-start justify-between gap-3 animate-in fade-in slide-in-from-left duration-500 delay-100">
        <div className="flex items-center gap-3 sm:gap-4 group min-w-0">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 shadow-xl ring-2 ring-blue-100/50 dark:ring-slate-700/50 p-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-hover:ring-blue-200 dark:group-hover:ring-slate-600">
            <img 
              src={novartisLogo} 
              alt="Novartis Logo" 
              className="h-full w-full object-contain filter dark:brightness-110 transition-transform duration-300 group-hover:scale-105" 
            />
          </div>
          <div className="animate-in fade-in slide-in-from-left duration-500 delay-200 min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Novartis</p>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text truncate">Log Access Portal</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Secure access for Kubernetes workloads</p>
          </div>
        </div>
        <button
          onClick={toggleDarkMode}
          className="shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 hover:from-slate-200 hover:to-slate-300 dark:from-slate-700 dark:to-slate-800 dark:text-yellow-300 dark:hover:from-slate-600 dark:hover:to-slate-700 transition-all duration-300 hover:scale-110 hover:shadow-lg touch-manipulation"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="h-5 w-5 transition-transform duration-300 hover:rotate-180" /> : <Moon className="h-5 w-5 transition-transform duration-300 hover:rotate-12" />}
        </button>
      </header>

      <Card className="border-0 shadow-2xl backdrop-blur-sm bg-card/95 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 hover:shadow-3xl transition-all duration-500 overflow-hidden group">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 px-6 py-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/95 dark:bg-slate-100 shadow-xl ring-4 ring-white/20 dark:ring-slate-200/20 animate-in zoom-in duration-500 delay-300 group-hover:scale-110 transition-transform duration-300">
            <Lock className="h-8 w-8 text-blue-600 dark:text-blue-700 transition-transform duration-300 group-hover:rotate-12" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white dark:text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-400">Sign in to continue</h1>
          <p className="mt-2 text-blue-50/90 dark:text-blue-100/90 animate-in fade-in duration-500 delay-500">Use your team credentials to access environment logs.</p>
        </div>
        <CardContent className="p-5 sm:p-8 bg-gradient-to-b from-card to-card/95">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 animate-in fade-in slide-in-from-left duration-500 delay-300">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">Username</Label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors duration-300 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-11 transition-all duration-300 border-muted-foreground/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-muted-foreground/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 animate-in fade-in slide-in-from-left duration-500 delay-400">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors duration-300 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-11 h-11 transition-all duration-300 border-muted-foreground/20 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-muted-foreground/40"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1 text-muted-foreground hover:text-foreground transition-all duration-300 hover:scale-110 touch-manipulation"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500 group"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="-ml-1 mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <LogIn className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  Sign In
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}