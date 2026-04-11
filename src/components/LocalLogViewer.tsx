import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Download, 
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

interface LocalLogFile {
  name: string;
  size: string;
  modified: string;
  type: 'info' | 'error' | 'debug' | 'warning';
}

interface LocalLogViewerProps {
  logFile: LocalLogFile;
  onBack: () => void;
}

export function LocalLogViewer({ logFile, onBack }: LocalLogViewerProps) {
  const [logContent, setLogContent] = useState<string[]>([]);
  const [filteredContent, setFilteredContent] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // API base URL for local files
  const API_BASE_URL = '/api';

  const fetchLogContent = async (): Promise<string[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/logs/local/log.txt`);
      if (!response.ok) throw new Error('Failed to fetch log content');
      const data = await response.json();
      return (data.content || '').split('\n').filter((line: string) => line.trim());
    } catch (error) {
      console.error('Error fetching log content:', error);
      throw new Error('Failed to fetch log content');
    }
  };

  useEffect(() => {
    const loadLogContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const content = await fetchLogContent();
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
  }, []);

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
      const content = await fetchLogContent();
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
    const logContent = filteredContent.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = logFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download Complete",
      description: `${logFile.name} has been downloaded`,
    });
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(`Log File: ${logFile.name}`);
    const body = encodeURIComponent(`Please find the log file content below:\n\n${filteredContent.slice(0, 100).join('\n')}${filteredContent.length > 100 ? '\n\n... (truncated)' : ''}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    
    toast({
      title: "Email Client Opened",
      description: "Your email client should open with the log content",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading logs...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">{logFile.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{logContent.length} • Modified {logFile.modified}</span>
                  <Badge variant={logFile.type === 'error' ? 'destructive' : 'default'}>
                    {logFile.type}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={refreshLog} variant="outline" size="sm" className="gap-2" disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
<Button onClick={downloadLog} variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button onClick={shareByEmail} variant="outline" size="sm" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in log content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Log Content */}
        <Card className="fade-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Log Content ({filteredContent.length} lines)
              <Badge variant="secondary">Real-time data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
                {error}
              </div>
            ) : (
              <ScrollArea className="h-[70vh] w-full">
                <div className="space-y-1 font-mono text-sm">
                  {filteredContent.map((line, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(line);
                        toast({
                          title: "Line Copied",
                          description: "Log line copied to clipboard",
                        });
                      }}
                    >
                      <span className="text-muted-foreground mr-3">
                        {String(index + 1).padStart(4, '0')}
                      </span>
                      {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




