import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Server,
  Box,
  Folder,
  Layers,
  Network,
  HardDrive,
  FileCode,
  LogOut,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  Plus,
  X,
  Menu,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { sortTableData, type SortDirection } from "@/lib/table-sort";

const getSessionHeaders = () => {
  const sessionId = localStorage.getItem("sessionId");
  return {
    "Content-Type": "application/json",
    ...(sessionId && { "x-session-id": sessionId }),
  };
};

type ResourceKind =
  | "clusters"
  | "nodes"
  | "namespaces"
  | "deployments"
  | "daemonsets"
  | "statefulsets"
  | "replicasets"
  | "replicationcontrollers"
  | "jobs"
  | "cronjobs"
  | "pods"
  | "configmaps"
  | "secrets"
  | "services"
  | "ingresses"
  | "networkpolicies"
  | "persistentvolumes"
  | "persistentvolumeclaims"
  | "customresourcedefinitions";

const RESOURCE_LABELS: Record<ResourceKind, string> = {
  clusters: "Cluster",
  nodes: "Node",
  namespaces: "Namespace",
  deployments: "Deployment",
  daemonsets: "DaemonSet",
  statefulsets: "StatefulSet",
  replicasets: "ReplicaSet",
  replicationcontrollers: "Replication Controller",
  jobs: "Job",
  cronjobs: "CronJob",
  pods: "Pod",
  configmaps: "ConfigMap",
  secrets: "Secret",
  services: "Service",
  ingresses: "Ingress",
  networkpolicies: "Network Policy",
  persistentvolumes: "Persistent Volume",
  persistentvolumeclaims: "Persistent Volume Claim",
  customresourcedefinitions: "Custom Resource Definition",
};

// Cluster observability table columns (enterprise dashboard)
const CLUSTER_TABLE_COLUMNS = [
  "cluster",
  "healthAlerts",
  "customAlerts",
  "nodes",
  "nodeWarningSignals",
  "namespaces",
  "workloadWarningSignals",
  "workloads",
  "cpuUsage",
  "memoryUsage",
  "pods",
  "kubernetesVersion",
  "clusterProvider",
  "lastUpdated",
];

const CLUSTER_COLUMN_LABELS: Record<string, string> = {
  cluster: "Cluster",
  healthAlerts: "Health Alerts",
  customAlerts: "Custom Alerts",
  nodes: "Nodes",
  nodeWarningSignals: "Node Warnings",
  namespaces: "Namespaces",
  workloadWarningSignals: "Workload Warnings",
  workloads: "Workloads",
  cpuUsage: "CPU Usage",
  memoryUsage: "Memory Usage",
  pods: "Pod Count",
  kubernetesVersion: "Kubernetes Version",
  clusterProvider: "Cluster Provider",
  lastUpdated: "Last Updated",
};

// Preferred column order for table display (Dynatrace-style)
const COLUMN_ORDER: Partial<Record<ResourceKind, string[]>> = {
  clusters: CLUSTER_TABLE_COLUMNS,
  nodes: ["name", "status", "roles", "age"],
  namespaces: ["name", "age"],
  deployments: ["name", "namespace", "ready", "replicas", "age"],
  daemonsets: ["name", "namespace", "desired", "current", "ready", "age"],
  statefulsets: ["name", "namespace", "ready", "replicas", "age"],
  replicasets: ["name", "namespace", "ready", "replicas", "age"],
  replicationcontrollers: ["name", "namespace", "replicas", "readyReplicas", "age"],
  jobs: ["name", "namespace", "completions", "duration", "age"],
  cronjobs: ["name", "namespace", "schedule", "suspend", "lastSchedule", "age"],
  pods: ["name", "status", "ready", "restarts", "age"],
  configmaps: ["name", "namespace", "dataKeys", "age"],
  secrets: ["name", "namespace", "type", "dataKeys", "age"],
  services: ["name", "namespace", "type", "clusterIP", "ports", "age"],
  ingresses: ["name", "namespace", "class", "hosts", "age"],
  networkpolicies: ["name", "namespace", "policyTypes", "age"],
  persistentvolumes: ["name", "capacity", "status", "claim", "storageClass", "age"],
  persistentvolumeclaims: ["name", "namespace", "status", "capacity", "volume", "storageClass", "age"],
  customresourcedefinitions: ["name", "group", "version", "scope", "kind", "plural", "age"],
};

function getDisplayColumns(kind: ResourceKind, data: Record<string, unknown>[]): string[] {
  if (kind === "clusters" && CLUSTER_TABLE_COLUMNS.length > 0) return CLUSTER_TABLE_COLUMNS;
  const order = COLUMN_ORDER[kind];
  if (data.length === 0) return order || [];
  const keys = Object.keys(data[0] || {});
  if (order) {
    const ordered = order.filter((c) => keys.includes(c));
    const rest = keys.filter((k) => !order.includes(k));
    return [...ordered, ...rest];
  }
  return keys;
}

const TIME_RANGE_OPTIONS = [
  { value: "30m", label: "Last 30 minutes" },
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
];

export type ClusterSummaryRow = {
  name: string;
  cluster: string;
  healthAlerts: number;
  customAlerts: number;
  nodes: number;
  nodeWarningSignals: number;
  namespaces: number;
  workloadWarningSignals: number;
  workloads: number;
  pods: number;
  cpuUsage: string;
  memoryUsage: string;
  kubernetesVersion: string;
  clusterProvider: string;
  lastUpdated: string;
  state?: string;
};

export type ClusterDetail = {
  name: string;
  nodes: number;
  namespaces: number;
  workloads: number;
  pods: number;
  services: number;
  containers: number;
  nodeNotReady: number;
  podPending: number;
  podFailed: number;
  podRunning: number;
  workloadsWithRestarting: number;
  state: string;
};

export default function Explorer() {
  const navigate = useNavigate();
  const [environments, setEnvironments] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [selectedNs, setSelectedNs] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<ResourceKind | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"health" | "utilization" | "metadata">("health");
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [workloadOpen, setWorkloadOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("30m");
  const [selectedClusterForPanel, setSelectedClusterForPanel] = useState<string | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterDetail | null>(null);
  const [clusterDetailLoading, setClusterDetailLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isExplorerUser = useCallback(() => {
    try {
      const userStr = localStorage.getItem("user");
      const sessionId = localStorage.getItem("sessionId");
      if (!sessionId || !userStr) return false;
      const user = JSON.parse(userStr) as { username?: string; canAccessExplorer?: boolean };
      return user?.username === "explorer" || user?.canAccessExplorer === true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isExplorerUser()) {
      navigate("/", { replace: true });
      return;
    }
  }, [isExplorerUser, navigate]);

  useEffect(() => {
    if (!isExplorerUser()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.EXPLORER.ENVIRONMENTS}`, {
          headers: getSessionHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch environments");
        const list = await res.json();
        if (!cancelled) {
          const arr = Array.isArray(list) ? list : [];
          setEnvironments(arr);
          if (arr.length > 0 && !selectedEnv) setSelectedEnv(arr[0]);
        }
      } catch (e) {
        if (!cancelled) setEnvironments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExplorerUser]);

  useEffect(() => {
    if (!selectedEnv) {
      setNamespaces([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.NAMESPACES(selectedEnv)}`,
          { headers: getSessionHeaders() }
        );
        if (!res.ok) throw new Error("Failed to fetch namespaces");
        const list = await res.json();
        if (!cancelled) {
          const arr = Array.isArray(list) ? list : [];
          setNamespaces(arr);
        }
      } catch {
        if (!cancelled) setNamespaces([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEnv]);

  function needsNamespace(k: ResourceKind): boolean {
    return !["clusters", "nodes", "namespaces", "persistentvolumes", "customresourcedefinitions"].includes(k);
  }

  const fetchData = useCallback(async () => {
    if (!selectedKind) {
      setData([]);
      return;
    }
    if (selectedKind === "clusters") {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.EXPLORER.CLUSTERS_SUMMARY}`, {
          headers: getSessionHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch cluster summaries");
        const list = await res.json();
        setData(Array.isArray(list) ? list : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load cluster summaries");
        setData([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (selectedKind === "namespaces") {
      setData(namespaces.map((name) => ({ name })));
      return;
    }
    if (!selectedEnv) {
      setData([]);
      return;
    }
    if (needsNamespace(selectedKind) && !selectedNs) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let url: string;
      const ns = selectedNs!;
      const env = selectedEnv!;
      switch (selectedKind) {
        case "nodes":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.NODES(env)}`;
          break;
        case "deployments":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.DEPLOYMENTS(env, ns)}`;
          break;
        case "daemonsets":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.DAEMONSETS(env, ns)}`;
          break;
        case "statefulsets":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.STATEFULSETS(env, ns)}`;
          break;
        case "replicasets":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.REPLICASETS(env, ns)}`;
          break;
        case "replicationcontrollers":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.REPLICATIONCONTROLLERS(env, ns)}`;
          break;
        case "jobs":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.JOBS(env, ns)}`;
          break;
        case "cronjobs":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.CRONJOBS(env, ns)}`;
          break;
        case "pods":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.PODS(env, ns)}`;
          break;
        case "configmaps":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.CONFIGMAPS(env, ns)}`;
          break;
        case "secrets":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.SECRETS(env, ns)}`;
          break;
        case "services":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.SERVICES(env, ns)}`;
          break;
        case "ingresses":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.INGRESSES(env, ns)}`;
          break;
        case "networkpolicies":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.NETWORKPOLICIES(env, ns)}`;
          break;
        case "persistentvolumes":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.PERSISTENTVOLUMES(env)}`;
          break;
        case "persistentvolumeclaims":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.PERSISTENTVOLUMECLAIMS(env, ns)}`;
          break;
        case "customresourcedefinitions":
          url = `${API_BASE_URL}${API_ENDPOINTS.EXPLORER.CUSTOMRESOURCEDEFINITIONS(env)}`;
          break;
        default:
          setData([]);
          setLoading(false);
          return;
      }
      const res = await fetch(url, { headers: getSessionHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      setData(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEnv, selectedNs, selectedKind, namespaces, environments]);

  useEffect(() => {
    if (selectedKind === "clusters") {
      fetchData();
      return;
    }
    if (selectedKind === "namespaces") {
      setData(namespaces.map((name) => ({ name })));
      return;
    }
    fetchData();
  }, [selectedKind, selectedEnv, selectedNs, namespaces, environments, fetchData]);

  // Auto-refresh cluster summary every 30s when viewing clusters
  useEffect(() => {
    if (selectedKind !== "clusters") return;
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [selectedKind, fetchData]);

  // Fetch cluster detail when right panel is open
  useEffect(() => {
    if (!selectedClusterForPanel) {
      setClusterDetail(null);
      return;
    }
    let cancelled = false;
    setClusterDetailLoading(true);
    fetch(`${API_BASE_URL}${API_ENDPOINTS.EXPLORER.CLUSTER_DETAIL(selectedClusterForPanel)}`, {
      headers: getSessionHeaders(),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load cluster detail"))))
      .then((d) => {
        if (!cancelled) setClusterDetail(d);
      })
      .catch(() => {
        if (!cancelled) setClusterDetail(null);
      })
      .finally(() => {
        if (!cancelled) setClusterDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClusterForPanel]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleLogout = () => {
    localStorage.removeItem("sessionId");
    localStorage.removeItem("user");
    localStorage.removeItem("isAdmin");
    navigate("/", { replace: true });
    window.location.reload();
  };

  const displayColumns = useMemo(
    () => (selectedKind ? getDisplayColumns(selectedKind, data) : []),
    [selectedKind, data]
  );
  const allColumns = useMemo(
    () => (data[0] && typeof data[0] === "object" ? Object.keys(data[0] as Record<string, unknown>) : []),
    [data]
  );
  const hiddenCount = Math.max(0, allColumns.length - displayColumns.length);

  const sortedData = useMemo(() => {
    if (data.length === 0 || !sortColumn || !displayColumns.includes(sortColumn))
      return data;
    return sortTableData(
      data as Record<string, unknown>[],
      sortColumn,
      sortDirection
    );
  }, [data, sortColumn, sortDirection, displayColumns]);

  if (!isExplorerUser()) return null;

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    );
  };

  const kind = selectedKind;
  const canShowView =
    (kind as ResourceKind | null) === "clusters" ||
    (kind && kind !== "clusters" && (kind === "namespaces" ? selectedEnv : true) && (!needsNamespace(kind) || selectedNs));

  const title =
    selectedKind === "clusters"
      ? `Clusters ${data.length}`
      : selectedKind
        ? `${RESOURCE_LABELS[selectedKind]}${selectedKind === "namespaces" ? "" : "s"} ${data.length}`
        : "";

  const filterLower = sidebarFilter.toLowerCase();
  const match = (label: string) => !filterLower || label.toLowerCase().includes(filterLower);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar - Dynatrace style */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-wrap">
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 touch-manipulation" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2 min-h-10 touch-manipulation shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </Button>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <span className="text-sm font-medium shrink-0">Explorer</span>
          {environments.length > 0 && (
            <>
              <Select
                value={selectedEnv || ""}
                onValueChange={(v) => {
                  setSelectedEnv(v);
                  setSelectedNs(null);
                }}
              >
                <SelectTrigger className="w-full min-w-0 sm:w-[180px] h-9 sm:h-8 text-sm">
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {needsNamespace(selectedKind!) && namespaces.length > 0 && (
                <Select
                  value={selectedNs || ""}
                  onValueChange={setSelectedNs}
                >
                  <SelectTrigger className="w-full min-w-0 sm:w-[160px] h-9 sm:h-8 text-sm">
                    <SelectValue placeholder="Namespace" />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces.map((ns) => (
                      <SelectItem key={ns} value={ns}>
                        {ns}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedKind === "clusters" && (
            <>
              <Button variant="outline" size="sm" className="gap-2 min-h-10 touch-manipulation hidden sm:inline-flex">
                <Plus className="h-4 w-4" />
                Add cluster
              </Button>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[130px] sm:w-[160px] h-9 sm:h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="hidden lg:inline-flex min-h-10">Now</Button>
              <Button variant="ghost" size="sm" className="hidden lg:inline-flex min-h-10">Summary</Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="gap-2 min-h-10 touch-manipulation">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 min-h-10 touch-manipulation">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Dynatrace style (hidden on mobile; use Sheet instead) */}
        <aside className="hidden md:flex w-60 border-r bg-card flex-col shrink-0">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type to filter"
                value={sidebarFilter}
                onChange={(e) => setSidebarFilter(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2 space-y-0.5 text-sm">
              {/* Cluster */}
              {match("Cluster") && (
                <button
                  onClick={() => setSelectedKind("clusters")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                    selectedKind === "clusters" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Server className="h-4 w-4 shrink-0" />
                  Cluster
                  {selectedKind === "clusters" && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              )}

              {/* Node */}
              {match("Node") && (
                <button
                  onClick={() => setSelectedKind("nodes")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                    selectedKind === "nodes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Box className="h-4 w-4 shrink-0" />
                  Node
                  {selectedKind === "nodes" && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              )}

              {/* Namespace */}
              {match("Namespace") && (
                <button
                  onClick={() => setSelectedKind("namespaces")}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left ${
                    selectedKind === "namespaces" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  Namespace
                  {selectedKind === "namespaces" && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              )}

              {/* Workload */}
              <>
                <button
                  onClick={() => setWorkloadOpen(!workloadOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-muted"
                  >
                    <HardDrive className="h-4 w-4 shrink-0" />
                    Workload
                    {workloadOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                  {workloadOpen && (
                    <div className="pl-4 space-y-0.5">
                      {(["deployments", "daemonsets", "statefulsets", "replicasets", "replicationcontrollers", "jobs", "cronjobs", "pods"] as ResourceKind[]).map(
                        (k) =>
                          match(RESOURCE_LABELS[k]) && (
                            <button
                              key={k}
                              onClick={() => {
                                setSelectedKind(k);
                                if (needsNamespace(k) && !selectedNs && namespaces.length > 0)
                                  setSelectedNs(namespaces[0]);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                                selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                              }`}
                            >
                              {RESOURCE_LABELS[k]}
                              {selectedKind === k && <ChevronRight className="h-4 w-4 ml-auto" />}
                            </button>
                          )
                      )}
                    </div>
                  )}
                </>

              {/* Config */}
              <>
                <button
                  onClick={() => setConfigOpen(!configOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-muted"
                  >
                    <FileCode className="h-4 w-4 shrink-0" />
                    Config
                    {configOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                  {configOpen && (
                    <div className="pl-4 space-y-0.5">
                      {(["configmaps", "secrets"] as ResourceKind[]).map(
                        (k) =>
                          match(RESOURCE_LABELS[k]) && (
                            <button
                              key={k}
                              onClick={() => {
                                setSelectedKind(k);
                                if (needsNamespace(k) && !selectedNs && namespaces.length > 0)
                                  setSelectedNs(namespaces[0]);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                                selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                              }`}
                            >
                              {RESOURCE_LABELS[k]}
                              {selectedKind === k && <ChevronRight className="h-4 w-4 ml-auto" />}
                            </button>
                          )
                      )}
                    </div>
                  )}
                </>

              {/* Network */}
              <>
                <button
                  onClick={() => setNetworkOpen(!networkOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-muted"
                  >
                    <Network className="h-4 w-4 shrink-0" />
                    Network
                    {networkOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                  {networkOpen && (
                    <div className="pl-4 space-y-0.5">
                      {(["services", "ingresses", "networkpolicies"] as ResourceKind[]).map(
                        (k) =>
                          match(RESOURCE_LABELS[k]) && (
                            <button
                              key={k}
                              onClick={() => {
                                setSelectedKind(k);
                                if (needsNamespace(k) && !selectedNs && namespaces.length > 0)
                                  setSelectedNs(namespaces[0]);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                                selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                              }`}
                            >
                              {RESOURCE_LABELS[k]}
                              {selectedKind === k && <ChevronRight className="h-4 w-4 ml-auto" />}
                            </button>
                          )
                      )}
                    </div>
                  )}
                </>

              {/* Storage */}
              <>
                <button
                  onClick={() => setStorageOpen(!storageOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-muted"
                  >
                    <HardDrive className="h-4 w-4 shrink-0" />
                    Storage
                    {storageOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                  {storageOpen && (
                    <div className="pl-4 space-y-0.5">
                      {match("Persistent Volume Claim") && (
                        <button
                          onClick={() => {
                            setSelectedKind("persistentvolumeclaims");
                            if (!selectedNs && namespaces.length > 0) setSelectedNs(namespaces[0]);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                            selectedKind === "persistentvolumeclaims" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          Persistent Volume Claim
                          {selectedKind === "persistentvolumeclaims" && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </button>
                      )}
                      {match("Persistent Volume") && (
                        <button
                          onClick={() => setSelectedKind("persistentvolumes")}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                            selectedKind === "persistentvolumes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          Persistent Volume
                          {selectedKind === "persistentvolumes" && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </button>
                      )}
                    </div>
                  )}
                </>

              {/* Custom Resources */}
              {match("Custom") && (
                <>
                  <button
                    onClick={() => setCustomOpen(!customOpen)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-muted"
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    Custom Resources
                    {customOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                  {customOpen && (
                    <div className="pl-4 space-y-0.5">
                      {match("CRD") && (
                        <button
                          onClick={() => setSelectedKind("customresourcedefinitions")}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left ${
                            selectedKind === "customresourcedefinitions" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                        >
                          Custom Resource Definitions
                          {selectedKind === "customresourcedefinitions" && <ChevronRight className="h-4 w-4 ml-auto" />}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </nav>
          </ScrollArea>
        </aside>

        {/* Mobile sidebar overlay */}
        {isMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0 flex flex-col">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type to filter"
                    value={sidebarFilter}
                    onChange={(e) => setSidebarFilter(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <nav className="p-2 space-y-0.5 text-sm" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) setSidebarOpen(false); }}>
                  {match("Cluster") && (
                    <button onClick={() => setSelectedKind("clusters")} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "clusters" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <Server className="h-4 w-4 shrink-0" /> Cluster
                    </button>
                  )}
                  {match("Node") && (
                    <button onClick={() => setSelectedKind("nodes")} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "nodes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <Box className="h-4 w-4 shrink-0" /> Node
                    </button>
                  )}
                  {match("Namespace") && (
                    <button onClick={() => setSelectedKind("namespaces")} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "namespaces" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <Folder className="h-4 w-4 shrink-0" /> Namespace
                    </button>
                  )}
                  {(["deployments", "daemonsets", "statefulsets", "replicasets", "replicationcontrollers", "jobs", "cronjobs", "pods"] as ResourceKind[]).map((k) => match(RESOURCE_LABELS[k]) && (
                    <button key={k} onClick={() => { setSelectedKind(k); if (needsNamespace(k) && !selectedNs && namespaces.length > 0) setSelectedNs(namespaces[0]); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <HardDrive className="h-4 w-4 shrink-0" /> {RESOURCE_LABELS[k]}
                    </button>
                  ))}
                  {(["configmaps", "secrets"] as ResourceKind[]).map((k) => match(RESOURCE_LABELS[k]) && (
                    <button key={k} onClick={() => { setSelectedKind(k); if (needsNamespace(k) && namespaces.length > 0 && !selectedNs) setSelectedNs(namespaces[0]); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <FileCode className="h-4 w-4 shrink-0" /> {RESOURCE_LABELS[k]}
                    </button>
                  ))}
                  {(["services", "ingresses", "networkpolicies"] as ResourceKind[]).map((k) => match(RESOURCE_LABELS[k]) && (
                    <button key={k} onClick={() => { setSelectedKind(k); if (needsNamespace(k) && namespaces.length > 0 && !selectedNs) setSelectedNs(namespaces[0]); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <Network className="h-4 w-4 shrink-0" /> {RESOURCE_LABELS[k]}
                    </button>
                  ))}
                  {match("Persistent Volume Claim") && (
                    <button onClick={() => { setSelectedKind("persistentvolumeclaims"); if (namespaces.length > 0 && !selectedNs) setSelectedNs(namespaces[0]); }} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "persistentvolumeclaims" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <HardDrive className="h-4 w-4 shrink-0" /> Persistent Volume Claim
                    </button>
                  )}
                  {match("Persistent Volume") && (
                    <button onClick={() => setSelectedKind("persistentvolumes")} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "persistentvolumes" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <HardDrive className="h-4 w-4 shrink-0" /> Persistent Volume
                    </button>
                  )}
                  {match("Custom") && (
                    <button onClick={() => setSelectedKind("customresourcedefinitions")} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left min-h-[44px] touch-manipulation ${selectedKind === "customresourcedefinitions" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                      <Layers className="h-4 w-4 shrink-0" /> Custom Resource Definitions
                    </button>
                  )}
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        )}

        {/* Right content - Dynatrace style */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {!selectedKind && (
            <div className="flex-1 flex items-center justify-center p-8">
              <Card className="max-w-md w-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Select a resource type from the left to view details.
                </CardContent>
              </Card>
            </div>
          )}

          {selectedKind && !canShowView && (
            <div className="flex-1 flex items-center justify-center p-8">
              <Card className="max-w-md w-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  {!selectedEnv
                    ? "Select a cluster from the dropdown above."
                    : needsNamespace(selectedKind) && !selectedNs
                      ? "Select a namespace from the dropdown above."
                      : "Loading..."}
                </CardContent>
              </Card>
            </div>
          )}

          {selectedKind && canShowView && (
            <div className={`flex flex-col flex-1 overflow-hidden p-3 sm:p-4 ${selectedKind === "clusters" && selectedClusterForPanel ? "md:flex-row gap-4" : ""}`}>
              <div className={`flex flex-col flex-1 overflow-hidden min-w-0 ${selectedKind === "clusters" && selectedClusterForPanel ? "min-w-0 flex-shrink" : ""}`}>
              {/* Title row: "Clusters 3" / "Deployments 5" - Dynatrace style */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
                {selectedKind !== "clusters" && (
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="gap-2 min-h-10 touch-manipulation shrink-0">
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                )}
              </div>
              {/* Cluster summary bar (when viewing clusters) */}
              {selectedKind === "clusters" && Array.isArray(data) && data.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 py-3 px-4 rounded-md bg-card border mb-4 text-sm">
                  <span className="font-medium text-foreground">Clusters {data.length}</span>
                  <span className="text-muted-foreground">Nodes {(data as ClusterSummaryRow[]).reduce((s, r) => s + (Number(r.nodes) || 0), 0)}</span>
                  <span className="text-muted-foreground">Namespaces {(data as ClusterSummaryRow[]).reduce((s, r) => s + (Number(r.namespaces) || 0), 0)}</span>
                  <span className="text-muted-foreground">Workloads {(data as ClusterSummaryRow[]).reduce((s, r) => s + (Number(r.workloads) || 0), 0)}</span>
                </div>
              )}
              {/* Summary bar (non-cluster views) */}
              {selectedKind !== "clusters" && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="font-medium text-foreground">{data.length} {selectedKind === "namespaces" ? "Namespaces" : RESOURCE_LABELS[selectedKind]}</span>
                  {selectedEnv && <span>Cluster: {selectedEnv}</span>}
                  {selectedNs && needsNamespace(selectedKind) && <span>Namespace: {selectedNs}</span>}
                </div>
              )}

              {/* Tabs: Health (List), Metadata */}
              <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "health" | "utilization" | "metadata")} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full sm:w-fit mb-2 flex-wrap gap-1">
                  <TabsTrigger value="health" className="min-h-10 touch-manipulation text-sm">Health</TabsTrigger>
                  <TabsTrigger value="utilization" className="min-h-10 touch-manipulation text-sm">Utilization</TabsTrigger>
                  <TabsTrigger value="metadata" className="min-h-10 touch-manipulation text-sm">Metadata</TabsTrigger>
                </TabsList>
                <TabsContent value="health" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
                  <Card>
                    <CardContent className="p-0">
                      {loading && (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {error && (
                        <div className="p-4 text-destructive text-sm border-b">{error}</div>
                      )}
                      {!loading && !error && (
                        <>
                          {data.length === 0 && (
                            <div className="py-12 text-center text-muted-foreground">No resources found.</div>
                          )}
                          {data.length > 0 && (
                            <>
                              {hiddenCount > 0 && (
                                <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                                  {hiddenCount} column{hiddenCount !== 1 ? "s" : ""} hidden
                                </div>
                              )}
                              <div className="overflow-x-auto touch-pan-x -mx-1 px-1">
                                <Table className="min-w-[800px]">
                                  <TableHeader>
                                    <TableRow>
                                      {displayColumns.map((col) => (
                                        <TableHead
                                          key={col}
                                          className="capitalize whitespace-nowrap cursor-pointer select-none hover:bg-muted/50 text-xs sm:text-sm"
                                          onClick={() => handleSort(col)}
                                        >
                                          <span className="inline-flex items-center">
                                            {selectedKind === "clusters" && CLUSTER_COLUMN_LABELS[col] ? CLUSTER_COLUMN_LABELS[col] : col}
                                            <SortIcon col={col} />
                                          </span>
                                        </TableHead>
                                      ))}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sortedData.map((row, i) => (
                                      <TableRow
                                        key={i}
                                        className={selectedKind === "clusters" ? "cursor-pointer hover:bg-muted/50" : ""}
                                        onClick={() => {
                                          if (selectedKind === "clusters") {
                                            const name = (row as ClusterSummaryRow).name ?? (row as Record<string, unknown>).cluster;
                                            setSelectedClusterForPanel(typeof name === "string" ? name : String(name));
                                          }
                                        }}
                                      >
                                        {displayColumns.map((col) => (
                                          <TableCell key={col} className="whitespace-nowrap text-xs sm:text-sm">
                                            {selectedKind === "clusters" && col === "lastUpdated"
                                              ? (() => {
                                                  const v = (row as Record<string, unknown>)[col];
                                                  if (!v) return "";
                                                  try {
                                                    const d = new Date(v as string);
                                                    const s = Math.round((Date.now() - d.getTime()) / 1000);
                                                    if (s < 60) return `${s}s ago`;
                                                    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                                                    return d.toLocaleString();
                                                  } catch {
                                                    return String(v);
                                                  }
                                                })()
                                              : String((row as Record<string, unknown>)[col] ?? "")}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="utilization" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
                  <Card>
                    <CardContent className="p-0">
                      {data.length > 0 && (
                        <>
                          {hiddenCount > 0 && (
                            <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                              {hiddenCount} column{hiddenCount !== 1 ? "s" : ""} hidden
                            </div>
                          )}
                          <div className="overflow-x-auto touch-pan-x -mx-1 px-1">
                            <Table className="min-w-[800px]">
                              <TableHeader>
                                <TableRow>
                                  {displayColumns.map((col) => (
                                    <TableHead
                                      key={col}
                                      className="capitalize whitespace-nowrap cursor-pointer select-none hover:bg-muted/50 text-xs sm:text-sm"
                                      onClick={() => handleSort(col)}
                                    >
                                      <span className="inline-flex items-center">
                                        {col}
                                        <SortIcon col={col} />
                                      </span>
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedData.map((row, i) => (
                                  <TableRow key={i}>
                                    {displayColumns.map((col) => (
                                      <TableCell key={col} className="whitespace-nowrap text-xs sm:text-sm">
                                        {String((row as Record<string, unknown>)[col] ?? "")}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                      {data.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">No utilization data.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="metadata" className="flex-1 overflow-auto mt-0 data-[state=inactive]:hidden">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground mb-2">Resource type: {RESOURCE_LABELS[selectedKind]}</p>
                      {selectedEnv && <p className="text-sm text-muted-foreground">Cluster: {selectedEnv}</p>}
                      {selectedNs && needsNamespace(selectedKind) && (
                        <p className="text-sm text-muted-foreground">Namespace: {selectedNs}</p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">Total items: {data.length}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              </div>

              {/* Right-side cluster details panel (Cluster view only) */}
              {selectedKind === "clusters" && selectedClusterForPanel && (
                <div className="w-full md:w-[45%] md:min-w-[380px] flex flex-col border rounded-lg bg-card overflow-hidden shrink-0 min-h-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                    <h2 className="font-semibold text-base sm:text-lg truncate">{selectedClusterForPanel}</h2>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 touch-manipulation" onClick={() => { setSelectedClusterForPanel(null); setClusterDetail(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {clusterDetailLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : clusterDetail ? (
                    <>
                      <div className="px-4 py-3 border-b space-y-2">
                        <p className="text-sm text-muted-foreground">Cluster type: Kubernetes</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span>Nodes: {clusterDetail.nodes}</span>
                          <span>Namespaces: {clusterDetail.namespaces}</span>
                          <span>Workloads: {clusterDetail.workloads}</span>
                          <span>Pods: {clusterDetail.pods}</span>
                          <span>Services: {clusterDetail.services}</span>
                          <span>Containers: {clusterDetail.containers}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {clusterDetail.state === "Healthy" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {(clusterDetail.state === "Warning" || clusterDetail.state === "Unhealthy") && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          <span className="text-sm font-medium">{clusterDetail.state}</span>
                        </div>
                      </div>
                      <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="w-full justify-start rounded-none border-b h-auto p-0 gap-0 flex-wrap">
                          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">Overview</TabsTrigger>
                          <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">Info</TabsTrigger>
                          <TabsTrigger value="utilization" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">Utilization</TabsTrigger>
                          <TabsTrigger value="logs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">Logs</TabsTrigger>
                          <TabsTrigger value="events" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">Events</TabsTrigger>
                          <TabsTrigger value="slos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4">SLOs</TabsTrigger>
                          <TabsTrigger value="vulnerabilities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4 hidden sm:inline-flex">Vulnerabilities</TabsTrigger>
                          <TabsTrigger value="telemetry" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary min-h-10 touch-manipulation text-xs sm:text-sm px-2 sm:px-4 hidden md:inline-flex">Telemetry</TabsTrigger>
                        </TabsList>
                        <div className="flex-1 overflow-auto p-4">
                          <TabsContent value="overview" className="mt-0 space-y-4">
                            <div>
                              <h3 className="text-sm font-medium mb-2">Cluster utilization</h3>
                              <div className="grid gap-3">
                                <Card>
                                  <CardContent className="p-3">
                                    <p className="text-sm font-medium">CPU</p>
                                    <p className="text-xs text-muted-foreground">Usage / Requests / Limits — aggregate from metrics server when available</p>
                                    <div className="mt-2 h-2 bg-muted rounded overflow-hidden">
                                      <div className="h-full bg-primary/70 rounded" style={{ width: "40%" }} />
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardContent className="p-3">
                                    <p className="text-sm font-medium">Memory</p>
                                    <p className="text-xs text-muted-foreground">Usage / Requests / Limits</p>
                                    <div className="mt-2 h-2 bg-muted rounded overflow-hidden">
                                      <div className="h-full bg-primary/70 rounded" style={{ width: "35%" }} />
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardContent className="p-3">
                                    <p className="text-sm font-medium">Pods</p>
                                    <p className="text-xs text-muted-foreground">Running {clusterDetail.podRunning} / Total {clusterDetail.pods}</p>
                                    <div className="mt-2 h-2 bg-muted rounded overflow-hidden">
                                      <div className="h-full bg-primary/70 rounded" style={{ width: clusterDetail.pods ? `${(clusterDetail.podRunning / clusterDetail.pods) * 100}%` : "0%" }} />
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm font-medium mb-2">Nodes {clusterDetail.nodes}</h3>
                              <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2">
                                  {clusterDetail.nodeNotReady === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                                  Nodes not ready: {clusterDetail.nodeNotReady === 0 ? "None" : clusterDetail.nodeNotReady}
                                </li>
                                <li className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                  Nodes with problematic conditions: None
                                </li>
                                <li className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                  Nodes with warning events: None
                                </li>
                              </ul>
                            </div>
                            <div>
                              <h3 className="text-sm font-medium mb-2">Workloads {clusterDetail.workloads}</h3>
                              <ul className="space-y-1 text-sm">
                                <li className="flex items-center gap-2">
                                  {clusterDetail.workloadsWithRestarting === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                                  Workloads with restarting containers: {clusterDetail.workloadsWithRestarting === 0 ? "None" : clusterDetail.workloadsWithRestarting}
                                </li>
                                <li className="flex items-center gap-2">
                                  {clusterDetail.podPending === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                                  Workloads with pending pods: {clusterDetail.podPending === 0 ? "None" : clusterDetail.podPending}
                                </li>
                                <li className="flex items-center gap-2">
                                  {clusterDetail.podFailed === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                                  Workloads with failed pods: {clusterDetail.podFailed === 0 ? "None" : clusterDetail.podFailed}
                                </li>
                                <li className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                  Workloads with problematic conditions: None
                                </li>
                                <li className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                  Workloads with warning events: —
                                </li>
                              </ul>
                            </div>
                          </TabsContent>
                          <TabsContent value="info" className="mt-0">
                            <p className="text-sm text-muted-foreground">Cluster metadata and ownership (placeholder).</p>
                          </TabsContent>
                          <TabsContent value="utilization" className="mt-0">
                            <p className="text-sm text-muted-foreground">Time series CPU / Memory / Pods charts (placeholder).</p>
                          </TabsContent>
                          <TabsContent value="logs" className="mt-0">
                            <p className="text-sm text-muted-foreground">Log histogram and severity (Loki/Elasticsearch placeholder).</p>
                          </TabsContent>
                          <TabsContent value="events" className="mt-0">
                            <p className="text-sm text-muted-foreground">Kubernetes events timeline (placeholder).</p>
                          </TabsContent>
                          <TabsContent value="slos" className="mt-0">
                            <p className="text-sm text-muted-foreground">SLO definitions and status (placeholder).</p>
                          </TabsContent>
                          <TabsContent value="vulnerabilities" className="mt-0">
                            <p className="text-sm text-muted-foreground">Security vulnerabilities (Trivy/Falco placeholder).</p>
                          </TabsContent>
                          <TabsContent value="telemetry" className="mt-0">
                            <p className="text-sm text-muted-foreground">Application telemetry metrics (placeholder).</p>
                          </TabsContent>
                        </div>
                      </Tabs>
                    </>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">Failed to load cluster detail.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
