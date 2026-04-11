import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogViewer } from "./LogViewer";
import { useToast } from "@/hooks/use-toast";
import { compareValues, type SortDirection } from "@/lib/table-sort";
import JSZip from "jszip";
import { 
  Download, 
  FileText, 
  LogOut, 
  RefreshCw, 
  Search,
  Calendar,
  HardDrive,
  ChevronRight,
  Server,
  Container,
  Folder,
  ArrowLeft,
  Eye,
  Mail,
  Share2,
  CheckSquare,
  Square,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

// API base URL - always use relative path for Docker/K8s compatibility
const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3006/api';

// Helper function to get session headers
const getSessionHeaders = () => {
  const sessionId = localStorage.getItem('sessionId');
  return {
    'Content-Type': 'application/json',
    ...(sessionId && { 'x-session-id': sessionId })
  };
};

// API functions with authentication
const fetchEnvironments = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/environments`, {
      headers: getSessionHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        // Session expired, redirect to login
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        sessionStorage.setItem('sessionExpired', '1');
        window.location.reload();
        return [];
      }
      throw new Error('Failed to fetch environments');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to fetch environments');
  }
};

const fetchNamespaces = async (environment: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/namespaces/${environment}`, {
      headers: getSessionHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        sessionStorage.setItem('sessionExpired', '1');
        window.location.reload();
        return [];
      }
      throw new Error('Failed to fetch namespaces');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to fetch namespaces');
  }
};

const fetchPods = async (environment: string, namespace: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/pods/${environment}/${namespace}`, {
      headers: getSessionHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        sessionStorage.setItem('sessionExpired', '1');
        window.location.reload();
        return [];
      }
      throw new Error('Failed to fetch pods');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to fetch pods');
  }
};

const fetchContainers = async (environment: string, namespace: string, pod: string): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/containers/${environment}/${namespace}/${pod}`, {
      headers: getSessionHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        sessionStorage.setItem('sessionExpired', '1');
        window.location.reload();
        return [];
      }
      throw new Error('Failed to fetch containers');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to fetch containers');
  }
};

// NEW: Enhanced API functions for better file browsing
const fetchContainerPaths = async (environment: string, namespace: string, pod: string, container: string): Promise<ContainerPath[]> => {
  const response = await fetch(`${API_BASE_URL}/container-paths/${environment}/${namespace}/${pod}/${container}`, {
    headers: getSessionHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      sessionStorage.setItem('sessionExpired', '1');
      window.location.reload();
      return [];
    }
    throw new Error('Failed to fetch container paths');
  }
  return response.json();
};

const fetchPathContents = async (environment: string, namespace: string, pod: string, container: string, path: string): Promise<PathItem[]> => {
  const response = await fetch(`${API_BASE_URL}/path-contents/${environment}/${namespace}/${pod}/${container}?path=${encodeURIComponent(path)}`, {
    headers: getSessionHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      sessionStorage.setItem('sessionExpired', '1');
      window.location.reload();
      return [];
    }
    throw new Error('Failed to fetch path contents');
  }
  return response.json();
};

// NEW: Dynamic directory browsing API
const fetchBrowse = async (environment: string, namespace: string, pod: string, container: string, path: string = '/'): Promise<PathItem[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/browse/${environment}/${namespace}/${pod}/${container}?path=${encodeURIComponent(path)}`, {
      headers: getSessionHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        sessionStorage.setItem('sessionExpired', '1');
        window.location.reload();
        return [];
      }
      throw new Error('Failed to browse path');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error('Failed to browse path');
  }
};

// Legacy functions for backward compatibility
const fetchLogPaths = async (environment: string, namespace: string, pod: string, container: string): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/log-paths/${environment}/${namespace}/${pod}/${container}`, {
    headers: getSessionHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      sessionStorage.setItem('sessionExpired', '1');
      window.location.reload();
      return [];
    }
    throw new Error('Failed to fetch log paths');
  }
  return response.json();
};

const fetchLogFiles = async (environment: string, namespace: string, pod: string, container: string, path?: string): Promise<LogFile[]> => {
  const url = `${API_BASE_URL}/log-files/${environment}/${namespace}/${pod}/${container}${path ? `?path=${encodeURIComponent(path)}` : ''}`;
  const response = await fetch(url, {
    headers: getSessionHeaders()
  });
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('sessionId');
      localStorage.removeItem('user');
      sessionStorage.setItem('sessionExpired', '1');
      window.location.reload();
      return [];
    }
    throw new Error('Failed to fetch log files');
  }
  return response.json();
};

interface LogBrowserProps {
  onLogout: () => void;
  user: {
    username: string;
    team: string;
    teamName: string;
  } | null;
}

interface NavigationState {
  step: 'environment' | 'namespace' | 'pod' | 'container' | 'path' | 'files';
  environment?: string;
  namespace?: string;
  pod?: string;
  container?: string;
  path?: string;
}

interface LogFile {
  name: string;
  size: string;
  modified: string;
  path?: string;
  type?: 'error' | 'info' | 'debug' | 'warning';
}

// NEW: Enhanced interfaces for better file browsing
interface ContainerPath {
  path: string;
  type: 'directory';
  exists: boolean;
}

interface PathItem {
  name: string;
  type: 'file' | 'directory' | 'link';
  size: string;
  modified: string;
  permissions: string;
  path: string;
}

export function LogBrowser({ onLogout, user }: LogBrowserProps) {
  const [navigation, setNavigation] = useState<NavigationState>({ step: 'environment' });
  const [selectedLog, setSelectedLog] = useState<LogFile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentData, setCurrentData] = useState<(string[] | LogFile[] | ContainerPath[] | PathItem[])>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browsePath, setBrowsePath] = useState<string>('/');
  const [isHistoryUpdate, setIsHistoryUpdate] = useState(false);
  const [environmentCount, setEnvironmentCount] = useState<number | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [fileSortColumn, setFileSortColumn] = useState<'name' | 'modified' | 'size' | 'type'>('name');
  const [fileSortDir, setFileSortDir] = useState<SortDirection>('asc');
  const { toast } = useToast();

  // Helper function to build URL from navigation state
  const buildUrlFromNavigation = useCallback((nav: NavigationState): string => {
    const parts: string[] = [];
    if (nav.environment) parts.push(`env=${encodeURIComponent(nav.environment)}`);
    if (nav.namespace) parts.push(`ns=${encodeURIComponent(nav.namespace)}`);
    if (nav.pod) parts.push(`pod=${encodeURIComponent(nav.pod)}`);
    if (nav.container) parts.push(`container=${encodeURIComponent(nav.container)}`);
    if (nav.path) parts.push(`path=${encodeURIComponent(nav.path)}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }, []);

  // Helper function to update browser history
  const updateHistory = useCallback((navState: NavigationState, replace: boolean = false) => {
    const url = buildUrlFromNavigation(navState);
    const state = { navigation: navState };
    
    if (replace) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
  }, [buildUrlFromNavigation]);

  // Helper function to restore navigation from URL or history state
  const restoreNavigationFromState = useCallback((state: NavigationState | null) => {
    if (state) {
      setIsHistoryUpdate(true);
      setNavigation(state);
      setSearchTerm("");
      setCurrentData([]);
    }
  }, []);

  // Initialize navigation from URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const navState: NavigationState = {
      step: 'environment'
    };

    if (urlParams.has('env')) {
      navState.environment = urlParams.get('env') || undefined;
      navState.step = 'namespace';
    }
    if (urlParams.has('ns')) {
      navState.namespace = urlParams.get('ns') || undefined;
      navState.step = 'pod';
    }
    if (urlParams.has('pod')) {
      navState.pod = urlParams.get('pod') || undefined;
      navState.step = 'container';
    }
    if (urlParams.has('container')) {
      navState.container = urlParams.get('container') || undefined;
      navState.step = 'path';
    }
    if (urlParams.has('path')) {
      navState.path = urlParams.get('path') || undefined;
      navState.step = 'files';
    }

    // Only restore if we have at least one parameter
    if (urlParams.toString()) {
      restoreNavigationFromState(navState);
      // Update history state to match URL
      window.history.replaceState({ navigation: navState }, '', window.location.href);
    } else {
      // Initial state - check if we should auto-select environment
      // This will be handled in loadData when step is 'environment'
      updateHistory(navState, true);
    }
  }, []);

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.navigation) {
        restoreNavigationFromState(event.state.navigation);
      } else {
        // If no state, go back to initial state
        restoreNavigationFromState({ step: 'environment' });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [restoreNavigationFromState]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let data: string[] | LogFile[] | ContainerPath[] | PathItem[] = [];
      
      switch (navigation.step) {
        case 'environment':
          data = await fetchEnvironments();
          setEnvironmentCount(data.length);
          // Auto-select environment if only one is available
          if (data.length === 1 && typeof data[0] === 'string') {
            const singleEnv = data[0];
            const autoNavState: NavigationState = {
              step: 'namespace',
              environment: singleEnv
            };
            setIsHistoryUpdate(false);
            setNavigation(autoNavState);
            // Update URL and history
            updateHistory(autoNavState, true);
            // Load namespaces immediately
            const namespaces = await fetchNamespaces(singleEnv);
            setCurrentData(namespaces);
            setLoading(false);
            return;
          }
          break;
        case 'namespace':
          if (navigation.environment) {
            data = await fetchNamespaces(navigation.environment);
          }
          break;
        case 'pod':
          if (navigation.environment && navigation.namespace) {
            data = await fetchPods(navigation.environment, navigation.namespace);
          }
          break;
        case 'container':
          if (navigation.environment && navigation.namespace && navigation.pod) {
            data = await fetchContainers(navigation.environment, navigation.namespace, navigation.pod);
          }
          break;
        case 'path':
          if (navigation.environment && navigation.namespace && navigation.pod && navigation.container) {
            // Use navigation.path if available (from breadcrumb), otherwise use browsePath
            const pathToBrowse = navigation.path || browsePath;
            data = await fetchBrowse(navigation.environment, navigation.namespace, navigation.pod, navigation.container, pathToBrowse);
          }
          break;
        case 'files':
          if (navigation.environment && navigation.namespace && navigation.pod && navigation.container && navigation.path) {
            // Use dynamic browse API for the selected path
            data = await fetchBrowse(navigation.environment, navigation.namespace, navigation.pod, navigation.container, navigation.path);
          }
          break;
      }
      
      setCurrentData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setCurrentData([]);
    } finally {
      setLoading(false);
    }
  };

  // Sync browsePath with navigation.path when navigating to a path
  useEffect(() => {
    if (navigation.path) {
      setBrowsePath(navigation.path);
    } else if (navigation.step === 'path') {
      // If navigation.path is cleared but we're still at path step, reset to root
      setBrowsePath('/');
    }
  }, [navigation.step, navigation.path]);

  useEffect(() => {
    // Only update history if this is a user-initiated navigation (not from browser back/forward)
    if (!isHistoryUpdate) {
      updateHistory(navigation);
    } else {
      // Reset the flag after handling history update
      setIsHistoryUpdate(false);
    }
    loadData();
  }, [navigation, isHistoryUpdate, updateHistory]);

  const getStepTitle = () => {
    switch (navigation.step) {
      case 'environment': return environmentCount === 1 ? 'Select Namespace' : 'Select Environment';
      case 'namespace': return 'Select Namespace';
      case 'pod': return 'Select Pod';
      case 'container': return 'Select Container';
      case 'path': return 'Select Log Path';
      case 'files': return 'Available Log Files';
      default: return '';
    }
  };

  const getStepDescription = () => {
    switch (navigation.step) {
      case 'environment': return 'Choose the environment to access logs from';
      case 'namespace': return `Choose a namespace in ${navigation.environment}`;
      case 'pod': return `Choose a pod in namespace ${navigation.namespace}`;
      case 'container': return `Choose a container in pod ${navigation.pod}`;
      case 'path': return `Choose a log directory in container ${navigation.container}`;
      case 'files': return `Log files in ${navigation.path}`;
      default: return '';
    }
  };

  const handleSelection = (value: string | { name: string } | null) => {
    const newNavigation = { ...navigation };
    const str = (v: typeof value): string => {
      if (v == null) return '';
      if (typeof v === 'object' && 'name' in v) return (v as { name: string }).name;
      return typeof v === 'string' ? v : '';
    };

    switch (navigation.step) {
      case 'environment':
        newNavigation.environment = str(value);
        newNavigation.step = 'namespace';
        break;
      case 'namespace':
        newNavigation.namespace = str(value);
        newNavigation.step = 'pod';
        break;
      case 'pod':
        // Handle pod objects - extract the name property
        newNavigation.pod = str(value);
        newNavigation.step = 'container';
        break;
      case 'container':
        newNavigation.container = str(value);
        newNavigation.step = 'path';
        setBrowsePath('/'); // Start at root
        break;
      case 'path': {
        // If directory, go deeper; if file, show file
        const pathVal = str(value);
        const item = (currentData as PathItem[]).find(i => i.path === pathVal);
        if (item && item.type === 'directory') {
          newNavigation.path = pathVal;
          newNavigation.step = 'files';
        } else if (item && item.type === 'file') {
          setSelectedLog({
            name: item.name,
            size: item.size,
            modified: item.modified,
            path: item.path
          });
          return;
        }
        break;
      }
      case 'files': {
        // If directory, go deeper; if file, show file
        const pathVal = str(value);
        const fileItem = (currentData as PathItem[]).find(i => i.path === pathVal);
        if (fileItem && fileItem.type === 'directory') {
          newNavigation.path = pathVal;
          // Stay in 'files' step, but update path
        } else if (fileItem && fileItem.type === 'file') {
          setSelectedLog({
            name: fileItem.name,
            size: fileItem.size,
            modified: fileItem.modified,
            path: fileItem.path
          });
          return;
        }
        break;
      }
    }

    setNavigation(newNavigation);
    setSearchTerm("");
    setCurrentData([]);
    setIsHistoryUpdate(false); // User-initiated navigation
  };

  const handleBack = async () => {
    if (navigation.step === 'environment') {
      // If we're at the first step, just reload the data
      loadData();
      return;
    }

    const newNavigation = { ...navigation };
    
    switch (navigation.step) {
      case 'namespace':
        // Check if there's only one environment - if so, skip environment step
        try {
          const environments = await fetchEnvironments();
          if (environments.length === 1) {
            // Only one environment - stay at namespace step, just clear namespace
            newNavigation.step = 'namespace';
            delete newNavigation.namespace;
            delete newNavigation.pod;
            delete newNavigation.container;
            delete newNavigation.path;
          } else {
            // Multiple environments - go back to environment selection
            newNavigation.step = 'environment';
            delete newNavigation.environment;
            delete newNavigation.namespace;
            delete newNavigation.pod;
            delete newNavigation.container;
            delete newNavigation.path;
          }
        } catch (error) {
          // On error, go back to environment step
          newNavigation.step = 'environment';
          delete newNavigation.environment;
          delete newNavigation.namespace;
          delete newNavigation.pod;
          delete newNavigation.container;
          delete newNavigation.path;
        }
        break;
      case 'pod':
        newNavigation.step = 'namespace';
        delete newNavigation.namespace;
        delete newNavigation.pod;
        delete newNavigation.container;
        delete newNavigation.path;
        break;
      case 'container':
        newNavigation.step = 'pod';
        delete newNavigation.pod;
        delete newNavigation.container;
        delete newNavigation.path;
        break;
      case 'path':
        newNavigation.step = 'container';
        delete newNavigation.container;
        delete newNavigation.path;
        break;
      case 'files':
        // If we're in a subdirectory, go up one level
        if (navigation.path && navigation.path !== '/') {
          const pathParts = navigation.path.split('/').filter(Boolean);
          pathParts.pop();
          newNavigation.path = pathParts.length > 0 ? `/${pathParts.join('/')}` : '/';
        } else {
          // If we're at the root, go back to path selection
          newNavigation.step = 'path';
          delete newNavigation.path;
        }
        break;
    }
    
    setNavigation(newNavigation);
    setSearchTerm("");
    setCurrentData([]);
    setIsHistoryUpdate(false); // User-initiated navigation
  };

  const handleDownload = (log: LogFile) => {
    // Simulate download
    const element = document.createElement('a');
    element.href = `data:text/plain;charset=utf-8,${encodeURIComponent(`Mock content for ${log.name}`)}`;
    element.download = log.name;
    element.click();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const getBreadcrumb = () => {
    const items: Array<{ label: string; navState: NavigationState }> = [];
    
    if (navigation.environment) {
      items.push({
        label: navigation.environment,
        navState: { step: 'namespace', environment: navigation.environment }
      });
    }
    if (navigation.namespace) {
      items.push({
        label: navigation.namespace,
        navState: { 
          step: 'pod', 
          environment: navigation.environment!,
          namespace: navigation.namespace 
        }
      });
    }
    if (navigation.pod) {
      items.push({
        label: navigation.pod,
        navState: { 
          step: 'container', 
          environment: navigation.environment!,
          namespace: navigation.namespace!,
          pod: navigation.pod 
        }
      });
    }
    if (navigation.container) {
      items.push({
        label: navigation.container,
        navState: { 
          step: 'path', 
          environment: navigation.environment!,
          namespace: navigation.namespace!,
          pod: navigation.pod!,
          container: navigation.container 
        }
      });
    }
    if (navigation.path) {
      // Split path into segments for better navigation
      // e.g., /app/dctm/server/dba/log -> /app, /app/dctm, /app/dctm/server, /app/dctm/server/dba, /app/dctm/server/dba/log
      const pathSegments = navigation.path.split('/').filter(segment => segment);
      let currentPath = '';
      
      pathSegments.forEach((segment, index) => {
        currentPath += '/' + segment;
        const isLastSegment = index === pathSegments.length - 1;
        
        items.push({
          label: segment,
          navState: { 
            // Always use 'files' step when clicking on a path segment to browse that directory
            step: 'files',
            environment: navigation.environment!,
            namespace: navigation.namespace!,
            pod: navigation.pod!,
            container: navigation.container!,
            path: currentPath
          }
        });
      });
    }
    return items;
  };

  const handleBreadcrumbClick = (navState: NavigationState) => {
    setIsHistoryUpdate(false); // User-initiated navigation
    setNavigation(navState);
    setSearchTerm("");
    setCurrentData([]);
    // Update browsePath when navigating to a path segment (for both 'path' and 'files' steps)
    if (navState.path) {
      setBrowsePath(navState.path);
    } else if (navState.step === 'path') {
      // If going back to path step without a specific path, reset to root
      setBrowsePath('/');
    }
  };

  const getFilteredData = () => {
    if (!searchTerm) return currentData;
    
    if (navigation.step === 'files') {
      return (currentData as PathItem[]).filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (navigation.step === 'path') {
      return (currentData as ContainerPath[]).filter(path => 
        path.path.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return (currentData as string[]).filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getSortedFileData = (): PathItem[] => {
    if (navigation.step !== 'files') return [];
    const list = getFilteredData() as PathItem[];
    if (list.length === 0) return [];
    return [...list].sort((a, b) => {
      if (fileSortColumn === 'name') return compareValues(a.name, b.name, fileSortDir, 'text');
      if (fileSortColumn === 'modified') return compareValues(a.modified, b.modified, fileSortDir, 'date');
      if (fileSortColumn === 'size') return compareValues(a.size, b.size, fileSortDir, 'size');
      if (fileSortColumn === 'type') return compareValues(a.type, b.type, fileSortDir, 'text');
      return 0;
    });
  };

  const handleFileSort = (col: 'name' | 'modified' | 'size' | 'type') => {
    if (fileSortColumn === col) setFileSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setFileSortColumn(col); setFileSortDir('asc'); }
  };

  const FileSortIcon = ({ col }: { col: 'name' | 'modified' | 'size' | 'type' }) => {
    if (fileSortColumn !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return fileSortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  // Get only file items (not directories) from filtered data
  const getFileItems = () => {
    if (navigation.step !== 'files') return [];
    return getFilteredData().filter(item => (item as PathItem).type === 'file') as PathItem[];
  };

  // Toggle file selection
  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  // Select all files
  const selectAllFiles = () => {
    const fileItems = getFileItems();
    setSelectedFiles(new Set(fileItems.map(item => item.path)));
  };

  // Deselect all files
  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  // Check if all files are selected
  const areAllFilesSelected = () => {
    const fileItems = getFileItems();
    return fileItems.length > 0 && fileItems.every(item => selectedFiles.has(item.path));
  };

  // Binary extensions: must use download=true and response.arrayBuffer() to avoid corruption
  const BINARY_EXTENSIONS = ['.zip', '.gz'];

  const isBinaryDownload = (fileName: string) =>
    BINARY_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));

  // Download a single file
  const downloadFile = async (pathItem: PathItem): Promise<void> => {
    const sessionId = localStorage.getItem('sessionId');
    const headers = {
      ...(sessionId && { 'x-session-id': sessionId }),
    };
    const url = `${API_BASE_URL}/file-content/${navigation.environment}/${navigation.namespace}/${navigation.pod}/${navigation.container}?filepath=${encodeURIComponent(pathItem.path)}`;

    if (isBinaryDownload(pathItem.name)) {
      const downloadUrl = `${url}&download=true`;
      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
      const data = await response.json();
      const b64 = data.contentBase64;
      if (!b64 || typeof b64 !== 'string') throw new Error('Invalid binary response');
      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = data.filename || pathItem.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    const response = await fetch(url, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    const data = await response.json();

    const blob = new Blob([data.content || ''], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = pathItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  // Bulk download selected files
  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsDownloading(true);
    const fileItems = getFileItems().filter(item => selectedFiles.has(item.path));
    
    try {
      // Download files sequentially with a small delay to avoid overwhelming the browser
      for (let i = 0; i < fileItems.length; i++) {
        try {
          await downloadFile(fileItems[i]);
          // Small delay between downloads
          if (i < fileItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (error) {
          console.error(`Failed to download ${fileItems[i].name}:`, error);
          // Continue with other files even if one fails
        }
      }
      
      // Clear selection after download
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Bulk download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Fetch file content as string (for text files in zip/email)
  const getFileContent = async (pathItem: PathItem): Promise<string> => {
    const sessionId = localStorage.getItem('sessionId');
    const headers = {
      'Content-Type': 'application/json',
      ...(sessionId && { 'x-session-id': sessionId })
    };
    const response = await fetch(
      `${API_BASE_URL}/file-content/${navigation.environment}/${navigation.namespace}/${navigation.pod}/${navigation.container}?filepath=${encodeURIComponent(pathItem.path)}`,
      { headers }
    );
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    const data = await response.json();
    return data.content ?? '';
  };

  // Fetch file as binary (for .zip etc. when adding to email zip) - backend returns JSON with contentBase64
  const getFileContentAsBinary = async (pathItem: PathItem): Promise<ArrayBuffer> => {
    const sessionId = localStorage.getItem('sessionId');
    const headers: HeadersInit = sessionId ? { 'x-session-id': sessionId } : {};
    const url = `${API_BASE_URL}/file-content/${navigation.environment}/${navigation.namespace}/${navigation.pod}/${navigation.container}?filepath=${encodeURIComponent(pathItem.path)}&download=true`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
    const data = await response.json();
    const b64 = data.contentBase64;
    if (!b64 || typeof b64 !== 'string') throw new Error('Invalid binary response');
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  };

  // Email files: zip selected files, download zip, open mail client with pre-filled subject/body
  const handleEmailFiles = async () => {
    if (selectedFiles.size === 0) return;
    const fileItems = getFileItems().filter(item => selectedFiles.has(item.path));
    if (fileItems.length === 0) return;

    setIsEmailing(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < fileItems.length; i++) {
        try {
          const pathItem = fileItems[i];
          const opts = { date: new Date(pathItem.modified) };
          if (isBinaryDownload(pathItem.name)) {
            const arrayBuffer = await getFileContentAsBinary(pathItem);
            zip.file(pathItem.name, arrayBuffer, opts);
          } else {
            const content = await getFileContent(pathItem);
            zip.file(pathItem.name, content, opts);
          }
          if (i < fileItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (err) {
          console.error(`Failed to add ${fileItems[i].name} to zip:`, err);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const podSlug = (navigation.pod ?? 'pod').replace(/\//g, '-');
      const containerSlug = (navigation.container ?? 'container').replace(/\//g, '-');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipName = `log-files-${podSlug}-${containerSlug}-${timestamp}.zip`;

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const envNs = [navigation.environment, navigation.namespace].filter(Boolean).join('/');
      const contextPath = envNs ? `${envNs}/${navigation.pod}/${navigation.container}` : `${navigation.pod}/${navigation.container}`;
      const fileList = fileItems.map(f => `- ${f.name}`).join('\n');
      const subject = `Log Files: ${fileItems.length} files from ${navigation.pod}/${navigation.container}`;
      const body = [
        `I'm sharing ${fileItems.length} log files from ${contextPath}.`,
        '',
        `The files are attached as a ZIP archive: ${zipName}`,
        '',
        'Files included:',
        fileList,
        '',
        `Please attach the downloaded ZIP file (${zipName}) to this email.`
      ].join('\n');

      toast({
        title: 'ZIP File Created',
        description: `${fileItems.length} files packaged. Please attach it to your email.`,
      });

      const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoLink;
    } catch (error) {
      console.error('Email files failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to create ZIP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsEmailing(false);
    }
  };

  // Clear selection when navigation changes
  useEffect(() => {
    setSelectedFiles(new Set());
  }, [navigation.step, navigation.path]);

  if (selectedLog) {
    return (
      <LogViewer 
        logFile={{
          ...selectedLog,
          path: selectedLog.path || `${navigation.environment}/${navigation.namespace}/${navigation.pod}/${navigation.container}`,
          type: 'info' as const
        }} 
        navigation={navigation}
        onBack={() => setSelectedLog(null)}
        onLogout={onLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="container mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 fade-in">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text font-serif truncate">
              Log Browser Portal
            </h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-lg">
              Navigate through Kubernetes resources to access log files
            </p>
            {user && (
              <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-muted-foreground truncate">
                Logged in as <span className="font-medium text-primary">{user.username}</span> | Team: <span className="font-medium text-primary">{user.teamName}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {user?.username === "explorer" && (
              <Button asChild variant="outline" size="default" className="gap-2 hover-lift min-h-10 touch-manipulation">
                <Link to="/explorer">
                  <Layers className="h-4 w-4" />
                  Explorer
                </Link>
              </Button>
            )}
            <ThemeToggle />
            <Button 
              onClick={onLogout} 
              variant="outline"
              className="gap-2 hover-lift min-h-10 touch-manipulation"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Breadcrumb */}
        {getBreadcrumb().length > 0 && (
          <Card className="mb-4 sm:mb-6 fade-in">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap overflow-x-auto touch-pan-x pb-1 -mb-1">
                {getBreadcrumb().map((item, index) => {
                  const isLast = index === getBreadcrumb().length - 1;
                  // Make path segments clickable - all except the last one when viewing files
                  const isPathSegment = item.navState.path !== undefined;
                  const isViewingFiles = navigation.step === 'files';
                  const isClickable = !isLast || (isPathSegment && isViewingFiles);
                  
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Always use the navState from the breadcrumb item
                          handleBreadcrumbClick(item.navState);
                        }}
                        className={`font-medium transition-colors min-h-[44px] flex items-center px-1 -mx-1 rounded touch-manipulation ${
                          isClickable
                            ? 'text-primary hover:text-primary/80 hover:underline cursor-pointer active:bg-muted/50'
                            : 'text-foreground cursor-default'
                        }`}
                        disabled={!isClickable}
                        title={isClickable ? `Go back to ${item.label}` : 'Current location'}
                      >
                        {item.label}
                      </button>
                      {isClickable && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Card className="fade-in">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                  {navigation.step === 'environment' && environmentCount !== 1 && <Server className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  {navigation.step === 'namespace' && <Container className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  {navigation.step === 'pod' && <HardDrive className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  {navigation.step === 'container' && <Container className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  {navigation.step === 'path' && <Folder className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  {navigation.step === 'files' && <FileText className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />}
                  <span className="truncate">{getStepTitle()}</span>
                </CardTitle>
                <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                  {getStepDescription()}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2">
                {navigation.step !== 'environment' && (
                  <Button
                    onClick={handleBack}
                    variant="outline"
                    size="sm"
                    className="gap-2 min-h-10 touch-manipulation"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}
                {/* Multi-select controls - only show when viewing files */}
                {navigation.step === 'files' && getFileItems().length > 0 && (
                  <>
                    <div className="flex items-center gap-2 border-r border-border pr-3 mr-3">
                      <Button
                        onClick={areAllFilesSelected() ? deselectAllFiles : selectAllFiles}
                        variant="outline"
                        size="sm"
                        className="gap-2 min-h-10 touch-manipulation"
                      >
                        {areAllFilesSelected() ? (
                          <>
                            <Square className="h-4 w-4" />
                            <span className="hidden sm:inline">Deselect All</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="h-4 w-4" />
                            <span className="hidden sm:inline">Select All</span>
                          </>
                        )}
                      </Button>
                      {selectedFiles.size > 0 && (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {selectedFiles.size} selected
                        </span>
                      )}
                    </div>
                    {selectedFiles.size > 0 && (
                      <>
                        <Button
                          onClick={handleBulkDownload}
                          variant="default"
                          size="sm"
                          disabled={isDownloading || isEmailing}
                          className="gap-2 min-h-10 touch-manipulation"
                        >
                          <Download className={`h-4 w-4 shrink-0 ${isDownloading ? 'animate-spin' : ''}`} />
                          <span className="truncate">{isDownloading ? `Downloading... (${selectedFiles.size})` : `Download ${selectedFiles.size}`}</span>
                        </Button>
                        <Button
                          onClick={handleEmailFiles}
                          variant="outline"
                          size="sm"
                          disabled={isDownloading || isEmailing}
                          className="gap-2 min-h-10 touch-manipulation"
                        >
                          <Mail className={`h-4 w-4 shrink-0 ${isEmailing ? 'animate-spin' : ''}`} />
                          <span className="truncate">{isEmailing ? `Preparing... (${selectedFiles.size})` : `Email ${selectedFiles.size}`}</span>
                        </Button>
                      </>
                    )}
                  </>
                )}
                <div className="relative w-full sm:w-auto min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full sm:w-64 min-h-10"
                  />
                </div>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  disabled={isRefreshing}
                  className="gap-2 min-h-10 touch-manipulation"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-destructive text-lg font-semibold mb-2">Error</div>
                  <div className="text-muted-foreground">{error}</div>
                </div>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : getFilteredData().length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-muted-foreground text-lg mb-2">No items found</div>
                  <div className="text-sm text-muted-foreground">
                    {navigation.step === 'pod' && 'No pods in this namespace'}
                    {navigation.step === 'container' && 'No containers found in this pod'}
                    {navigation.step === 'path' && 'No accessible paths found in this container'}
                    {navigation.step === 'files' && 'No files found in this directory'}
                    {navigation.step === 'namespace' && 'No accessible namespaces found'}
                    {navigation.step === 'environment' && environmentCount !== 1 && 'No environments available'}
                  </div>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[400px] sm:h-[500px]">
                <div className="space-y-3">
                  {navigation.step === 'files' ? (
                    <div className="overflow-x-auto touch-pan-x -mx-1 px-1">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleFileSort('name')}
                          >
                            <span className="inline-flex items-center">Name <FileSortIcon col="name" /></span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleFileSort('modified')}
                          >
                            <span className="inline-flex items-center">Date Modified <FileSortIcon col="modified" /></span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleFileSort('size')}
                          >
                            <span className="inline-flex items-center">Size <FileSortIcon col="size" /></span>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleFileSort('type')}
                          >
                            <span className="inline-flex items-center">Type <FileSortIcon col="type" /></span>
                          </TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getSortedFileData().map((pathItem, index) => (
                          <TableRow
                            key={pathItem.path}
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={() => {
                              if (pathItem.type === 'file') {
                                setSelectedLog({
                                  name: pathItem.name,
                                  size: pathItem.size,
                                  modified: pathItem.modified,
                                  path: pathItem.path
                                });
                              } else if (pathItem.type === 'directory') {
                                handleSelection(pathItem.path);
                              }
                            }}
                          >
                            <TableCell className="w-10 py-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                              {pathItem.type === 'file' && (
                                <div
                                  className="cursor-pointer p-2 sm:p-1 hover:bg-accent rounded touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                                  onClick={() => toggleFileSelection(pathItem.path)}
                                >
                                  {selectedFiles.has(pathItem.path) ? (
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Square className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-primary/10">
                                  {pathItem.type === 'directory' ? (
                                    <Folder className="h-4 w-4 text-primary" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-primary" />
                                  )}
                                </div>
                                <span className="font-medium">{pathItem.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground text-sm">{pathItem.modified}</TableCell>
                            <TableCell className="py-2 text-muted-foreground text-sm">{pathItem.size}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className="text-xs">{pathItem.type}</Badge>
                            </TableCell>
                            <TableCell className="w-12 py-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                              {pathItem.type === 'file' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation"
                                  onClick={async () => {
                                    try {
                                      await downloadFile(pathItem);
                                    } catch (err) {
                                      console.error('Download failed:', err);
                                    }
                                  }}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  ) : getFilteredData().map((item, index) => (
                    <div key={index} className="stagger-item">
                      {navigation.step === 'path' && typeof item === 'object' && 'type' in item && (item as ContainerPath).type === 'directory' ? (
                        <div 
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer group hover-lift"
                          onClick={() => handleSelection((item as ContainerPath).path)}
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                              <Folder className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {(item as ContainerPath).path}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-xs">
                                  Directory
                                </Badge>
                                <span className="flex items-center gap-1">
                                  <Server className="h-3 w-3" />
                                  Available
                                </span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      ) : (
                        // Legacy string-based display for other steps
                        <div 
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all duration-200 cursor-pointer group hover-lift"
                          onClick={() => handleSelection(item as string)}
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <div className="p-2 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                              {navigation.step === 'environment' && environmentCount !== 1 && <Server className="h-5 w-5 text-primary" />}
                              {navigation.step === 'namespace' && <Container className="h-5 w-5 text-primary" />}
                              {navigation.step === 'pod' && <HardDrive className="h-5 w-5 text-primary" />}
                              {navigation.step === 'container' && <Container className="h-5 w-5 text-primary" />}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {navigation.step === 'pod' && typeof item === 'object' && item !== null && 'name' in item 
                                  ? (item as { name: string }).name 
                                  : item as string}
                              </h3>
                              {navigation.step === 'pod' && typeof item === 'object' && item !== null && 'status' in item && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {(item as { status: string }).status}
                                  </Badge>
                                  <span className="flex items-center gap-1">
                                    <HardDrive className="h-3 w-3" />
                                    {(item as { ready: string }).ready}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      )}
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