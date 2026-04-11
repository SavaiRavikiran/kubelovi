import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Download, 
  LogOut,
  Search,
  RefreshCw,
  FileText,
  Clock,
  Mail,
  Share2
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface LogFile {
  name: string;
  size: string;
  modified: string;
  type: 'error' | 'info' | 'debug' | 'warning';
  path?: string;
}

interface NavigationState {
  step: 'environment' | 'namespace' | 'pod' | 'container' | 'path' | 'files';
  environment?: string;
  namespace?: string;
  pod?: string;
  container?: string;
  path?: string;
}

interface LogViewerProps {
  logFile: LogFile;
  navigation?: NavigationState;
  onBack: () => void;
  onLogout: () => void;
}

export function LogViewer({ logFile, navigation, onBack, onLogout }: LogViewerProps) {
  const [logContent, setLogContent] = useState<string[]>([]);
  const [filteredContent, setFilteredContent] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // API base URL - always use relative path for Docker/K8s compatibility
  const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3006/api';

  const fetchLogContent = async (logFile: LogFile, navigation?: NavigationState): Promise<string[]> => {
    // Check if this is a local log file
    if (logFile.name === 'log.txt' && !logFile.path) {
      // This is a local log file, use the local endpoint
      const response = await fetch(`${API_BASE_URL}/logs/local/log.txt`);
      if (!response.ok) throw new Error('Failed to fetch log file content');
      const data = await response.json();
      return (data.content || '').split('\n').filter((line: string) => line.trim());
    }
    
    // For container files, construct the API URL ba{"error":"Authentication required"}sed on the navigation context
    if (logFile.path && navigation) {
      const url = `${API_BASE_URL}/file-content/${navigation.environment}/${navigation.namespace}/${navigation.pod}/${navigation.container}?filepath=${encodeURIComponent(logFile.path)}`;
      console.log('Fetching file content from URL:', url);
      console.log('File path:', logFile.path);
      console.log('Navigation:', navigation);
      
      // Get session headers for authentication
      const sessionId = localStorage.getItem('sessionId');
      const headers = {
        'Content-Type': 'application/json',
        ...(sessionId && { 'x-session-id': sessionId })
      };
      
      const response = await fetch(url, { headers });
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch log file content: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      const content = (data.content || '').split('\n');
      console.log('Parsed content lines:', content.length, content);
      
      return content;
    }
    
    // Fallback for other cases
    return ['No content available'];
  };

  useEffect(() => {
    const loadLogContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const content = await fetchLogContent(logFile, navigation);
        setLogContent(content);
        setFilteredContent(content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load log content');
        setLogContent(['Error loading log content']);
        setFilteredContent(['Error loading log content']);
      } finally {
        setLoading(false);
      }
    };

    loadLogContent();
  }, [logFile, navigation]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = logContent.filter(line =>
        line.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredContent(filtered);
    } else {
      setFilteredContent(logContent);
    }
  }, [searchTerm, logContent]);

  const refreshLog = async () => {
    setIsRefreshing(true);
    try {
      const content = await fetchLogContent(logFile, navigation);
      setLogContent(content);
      setFilteredContent(content);
      toast({
        title: "Log Refreshed",
        description: `${logFile.name} has been updated`,
      });
    } catch (err) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh log content",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const downloadLog = () => {
    try {
      const logContent = filteredContent.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = logFile.name || 'log-file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: `${logFile.name} has been downloaded`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download the file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const shareByEmail = () => {
    // Create a text file with the log content
    const logContent = filteredContent.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const file = new File([blob], logFile.name || 'log-file.txt', { type: 'text/plain' });
    
    // Create a mailto link with the file as attachment (note: this will only work in some email clients)
    const subject = encodeURIComponent(`Log File: ${logFile.name}`);
    const body = encodeURIComponent('Please find the attached log file.');
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    
    // For better compatibility, we'll open the mail client first
    window.location.href = mailtoLink;
    
    // Show a toast message
    toast({
      title: "Email Client Opened",
      description: "Please attach the downloaded log file to your email",
    });
    
    // Automatically trigger download of the file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFile.name || 'log-file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLineClass = (line: string) => {
    if (line.includes('[ERROR]')) return 'text-destructive';
    if (line.includes('[WARNING]')) return 'text-warning';
    if (line.includes('[DEBUG]')) return 'text-muted-foreground';
    return 'text-log-text';
  };

  const highlightSearchTerm = (line: string) => {
    if (!searchTerm) return line;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = line.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-warning/30 px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <header className="border-b bg-card fade-in">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={onBack} className="hover-lift">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center font-serif">
                  <FileText className="h-5 w-5 mr-2" />
                  {logFile.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {logFile.size} • Modified {logFile.modified}
                </p>
              </div>
              <Badge variant={logFile.type === 'error' ? 'destructive' : 'default'}>
                {logFile.type}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Button variant="outline" onClick={refreshLog} disabled={isRefreshing} className="hover-lift">
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
<Button variant="outline" onClick={downloadLog} className="hover-lift">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" onClick={shareByEmail} className="hover-lift">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button variant="outline" onClick={onLogout} className="hover-lift">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-4 slide-up">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in log content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 transition-all duration-200 focus:scale-[1.02]"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2 fade-in">
              Found {filteredContent.length} lines matching "{searchTerm}"
            </p>
          )}
        </div>

        {/* Log Content */}
        <Card className="scale-in gradient-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base font-serif">
              <span className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Log Content ({filteredContent.length} lines)
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                Real-time data
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="m-4 p-4 bg-destructive/10 text-destructive rounded-lg">
                Error: {error}
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading logs...</span>
              </div>
            ) : (
              <ScrollArea className="h-[70vh] w-full">
                <div className="bg-log-bg border border-log-border rounded-b-lg">
                  <div className="p-4 font-mono text-sm space-y-1">
                    {filteredContent.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No log entries found matching your search.
                      </div>
                    ) : (
                      filteredContent.map((line, index) => (
                        <div
                          key={index}
                          className={`${getLogLineClass(line)} hover:bg-log-border/20 px-2 py-1 rounded transition-colors`}
                        >
                          <span className="text-muted-foreground mr-2 text-xs">
                            {String(index + 1).padStart(4, '0')}
                          </span>
                          {highlightSearchTerm(line)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}