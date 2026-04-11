import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import LogView from "./pages/LogView";
import NotFound from "./pages/NotFound";
import Explorer from "./pages/Explorer";
import { AdminDashboard } from "./components/AdminDashboard";
import { ThemeProvider } from "@/components/ThemeProvider";

const queryClient = new QueryClient();

function AdminRoute() {
  const navigate = useNavigate();
  const onLogout = () => {
    localStorage.removeItem("sessionId");
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
    navigate("/", { replace: true });
    window.location.reload();
  };
  return <AdminDashboard onLogout={onLogout} />;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/log" element={<LogView />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/admin" element={<AdminRoute />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
