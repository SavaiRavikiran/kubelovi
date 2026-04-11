import { useState, useEffect } from "react";
import { LoginForm } from "./LoginForm";
import { LogBrowser } from "./LogBrowser";
import { AdminDashboard } from "./AdminDashboard"; // Import AdminDashboard
import { useToast } from "@/hooks/use-toast";

import { API_BASE_URL } from '@/config/api';

interface User {
  username: string;
  team: string;
  teamName: string;
  canAccessExplorer?: boolean;
  canAccessAdminDashboard?: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  sessionId: string | null;
  isAdmin: boolean | null;
}

export function LogPortal() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    sessionId: null,
    isAdmin: null
  });
  const { toast } = useToast();

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Admin Dashboard vs Log Browser: use server flag canAccessAdminDashboard (policy-driven)
        const isAdmin = data.user.canAccessAdminDashboard === true;

        setAuthState({
          isAuthenticated: true,
          user: data.user,
          sessionId: data.sessionId,
          isAdmin: isAdmin
        });

        localStorage.setItem('sessionId', data.sessionId);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isAdmin', isAdmin.toString());

        toast({
          title: "Login Successful",
          description: isAdmin
            ? "Welcome Admin! Loading Admin Dashboard..."
            : `Welcome ${data.user.teamName}!`,
        });
      } else if (response.status === 403 && data.code === 'SESSION_LIMIT_REACHED') {
        toast({
          title: "Maximum session limit reached",
          description: data.message || data.error || "This application allows a maximum of 10 concurrent users. Please try again later.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: data.error || data.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Failed to connect to authentication server",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (sessionId) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'x-session-id': sessionId,
          },
        });
      }
    } catch (error) {
      // Logout errors are non-critical, silently continue
    } finally {
      // Clear local storage and state
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      localStorage.removeItem('isAdmin');
      setAuthState({
        isAuthenticated: false,
        user: null,
        sessionId: null,
        isAdmin: null
      });
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    }
  };

  // Check for existing session on component mount
  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    const userStr = localStorage.getItem('user');
    const isAdminStr = localStorage.getItem('isAdmin');

    if (sessionId && userStr && isAdminStr) {
      try {
        const user = JSON.parse(userStr);
        const isAdmin = isAdminStr === 'true';
        setAuthState({
          isAuthenticated: true,
          user,
          sessionId,
          isAdmin
        });
      } catch (error) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        localStorage.removeItem('isAdmin');
      }
    }
  }, []);

  // Show "Session expired" toast when redirected to login after 401
  useEffect(() => {
    if (authState.isAuthenticated) return;
    const expired = sessionStorage.getItem('sessionExpired');
    if (expired) {
      sessionStorage.removeItem('sessionExpired');
      toast({
        title: "Session expired",
        description: "You have been signed out due to inactivity. Please sign in again.",
        variant: "destructive",
      });
    }
  }, [authState.isAuthenticated, toast]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {!authState.isAuthenticated ? (
        <div className="flex min-h-screen flex-col lg:flex-row">
          <div className="relative hidden lg:flex lg:flex-1 overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950">
            {/* Animated background effects */}
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.3), transparent 45%)' }}></div>
            <div className="absolute inset-0 opacity-20 animate-pulse" style={{ backgroundImage: 'radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.4), transparent 50%)' }}></div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-blue-500/10 to-purple-500/10 animate-shimmer"></div>
            
            <div className="relative z-10 flex flex-1 flex-col justify-center px-16 py-20 text-slate-50 dark:text-slate-100">
              <p className="text-sm uppercase tracking-[0.4em] text-blue-200/90 dark:text-blue-300/90 animate-in fade-in slide-in-from-left duration-700 delay-100 font-medium">Observability Platform</p>
              <h1 className="mt-6 text-4xl font-semibold leading-tight lg:text-5xl bg-gradient-to-r from-white via-blue-50 to-indigo-50 bg-clip-text text-transparent animate-in fade-in slide-in-from-left duration-700 delay-200">
                Unified access to Kubernetes application logs
              </h1>
              <p className="mt-6 max-w-xl text-lg text-blue-100/90 dark:text-blue-200/90 animate-in fade-in slide-in-from-left duration-700 delay-300 leading-relaxed">
                Browse pods, drill into containers, and stream logs from every environment your team manages. Purpose-built for Novartis engineering teams.
              </p>
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-xl">
                <div className="rounded-xl border border-white/20 bg-white/10 dark:bg-white/15 p-6 backdrop-blur-md shadow-xl hover:bg-white/15 dark:hover:bg-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400 group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-white/20 dark:bg-white/10 group-hover:bg-white/30 transition-colors duration-300">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-blue-50 dark:text-blue-100 text-lg">Get logs using UI</p>
                  </div>
                  <p className="text-sm text-blue-100/90 dark:text-blue-200/90 leading-relaxed">Troubleshoot, search, and access all log files with an intuitive interface. Browse directories, filter by extension, and download logs seamlessly.</p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 dark:bg-white/15 p-6 backdrop-blur-md shadow-xl hover:bg-white/15 dark:hover:bg-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-white/20 dark:bg-white/10 group-hover:bg-white/30 transition-colors duration-300">
                      <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-blue-50 dark:text-blue-100 text-lg">Team-based security</p>
                  </div>
                  <p className="text-sm text-blue-100/90 dark:text-blue-200/90 leading-relaxed">Scoped access ensures teams only see the namespaces and pods they own.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background/95 to-muted/20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 px-4 py-8 sm:px-10 sm:py-12 lg:px-16 transition-colors duration-500 safe-area-padding">
            <LoginForm onLogin={handleLogin} />
          </div>
        </div>
      ) : authState.isAdmin ? (
        <div className="fade-in">
          <AdminDashboard onLogout={handleLogout} />
        </div>
      ) : (
        <div className="fade-in">
          <LogBrowser 
            user={authState.user!} 
            onLogout={handleLogout} 
          />
        </div>
      )}
    </div>
  );
}