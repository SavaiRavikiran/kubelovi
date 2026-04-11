import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useToast } from '../hooks/use-toast';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Settings, 
  Shield, 
  Database,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  Server,
  Download
} from 'lucide-react';

interface Team {
  name: string;
  users: string[];
  environments: string[] | '*';
  namespaces: Record<string, string[]> | '*';
  allowedPaths?: string[];
  blockedPaths?: string[];
  dynamicNamespaceFiltering?: boolean;
  namespacePattern?: string;
}

interface TeamsConfig {
  teams: Record<string, Team>;
  credentials: Record<string, string>;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [teamsConfig, setTeamsConfig] = useState<TeamsConfig>({ teams: {}, credentials: {} });
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>([]);
  const [availableNamespaces, setAvailableNamespaces] = useState<Record<string, string[]>>({});
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState<Team>({
    name: '',
    users: [],
    environments: [],
    namespaces: {}
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('teams');
  const { toast } = useToast();

  const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3006/api';

  const getSessionHeaders = () => {
    const sessionId = localStorage.getItem('sessionId');
    return {
      'Content-Type': 'application/json',
      ...(sessionId && { 'x-session-id': sessionId })
    };
  };

  useEffect(() => {
    loadTeamsConfig();
    loadAvailableEnvironments();
  }, []);

  const loadTeamsConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/teams`, {
        headers: getSessionHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to load teams');
      
      const config = await response.json();
      setTeamsConfig(config);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load teams configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEnvironments = async () => {
    try {
      console.log('Loading available environments...');
      const response = await fetch(`${API_BASE_URL}/admin/available-environments`, {
        headers: getSessionHeaders()
      });
      
      console.log('Environment API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Environment API error:', errorText);
        throw new Error(`Failed to load environments: ${response.status} - ${errorText}`);
      }
      
      const environments = await response.json();
      console.log('Available environments:', environments);
      setAvailableEnvironments(environments);
      
      // Load namespaces for each environment
      const namespacesData: Record<string, string[]> = {};
      for (const env of environments) {
        try {
          console.log(`Loading namespaces for environment: ${env}`);
          const nsResponse = await fetch(`${API_BASE_URL}/admin/available-namespaces/${env}`, {
            headers: getSessionHeaders()
          });
          if (nsResponse.ok) {
            namespacesData[env] = await nsResponse.json();
            console.log(`Namespaces for ${env}:`, namespacesData[env]);
          } else {
            console.error(`Failed to load namespaces for ${env}: ${nsResponse.status}`);
            namespacesData[env] = []; // Set empty array for failed environments
          }
        } catch (error) {
          console.error(`Failed to load namespaces for ${env}:`, error);
          namespacesData[env] = []; // Set empty array for failed environments
        }
      }
      setAvailableNamespaces(namespacesData);
    } catch (error) {
      console.error('Error loading environments:', error);
      
      // Set fallback data to prevent complete failure
      setAvailableEnvironments(['sbx', 'dev', 'devint', 'qa', 'prod']);
      setAvailableNamespaces({
        'sbx': [],
        'dev': [],
        'devint': [],
        'qa': [],
        'prod': []
      });
      
      toast({
        title: "Warning",
        description: "Some environments may have connectivity issues. Basic functionality is available.",
        variant: "destructive",
      });
    }
  };

  const saveTeamsConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/teams`, {
        method: 'PUT',
        headers: getSessionHeaders(),
        body: JSON.stringify(teamsConfig)
      });
      
      if (!response.ok) throw new Error('Failed to save configuration');
      
      toast({
        title: "Success",
        description: "Teams configuration saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save teams configuration",
        variant: "destructive"
      });
    }
  };

  const addTeam = async (teamId: string) => {
    if (!teamId || teamsConfig.teams[teamId]) return;
    
    try {
      const updatedConfig = {
        ...teamsConfig,
        teams: {
          ...teamsConfig.teams,
          [teamId]: { ...newTeam }
        }
      };
      
      // Add user credentials
      newTeam.users.forEach((user, index) => {
        updatedConfig.credentials[user] = `${user}123`; // Default password
      });
      
      setTeamsConfig(updatedConfig);
      
      // Save to backend
      const response = await fetch(`${API_BASE_URL}/admin/teams`, {
        method: 'PUT',
        headers: getSessionHeaders(),
        body: JSON.stringify(updatedConfig)
      });
      
      if (!response.ok) throw new Error('Failed to save new team');
      
      setNewTeam({
        name: '',
        users: [],
        environments: [],
        namespaces: {}
      });
      
      toast({
        title: "Success",
        description: `Team ${teamId} added successfully`
      });
    } catch (error) {
      // Reload original config on error
      await loadTeamsConfig();
      toast({
        title: "Error",
        description: "Failed to add team",
        variant: "destructive"
      });
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (teamId === 'admin') {
      toast({
        title: "Error",
        description: "Cannot delete admin team",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/admin/teams/${teamId}`, {
        method: 'DELETE',
        headers: getSessionHeaders()
      });
      
      if (!response.ok) throw new Error('Failed to delete team');
      
      await loadTeamsConfig(); // Reload config
      
      toast({
        title: "Success",
        description: `Team ${teamId} deleted successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive"
      });
    }
  };

  const updateTeam = (teamId: string, updatedTeam: Team) => {
    setTeamsConfig({
      ...teamsConfig,
      teams: {
        ...teamsConfig.teams,
        [teamId]: updatedTeam
      }
    });
    setEditingTeam(null);
  };

  const togglePasswordVisibility = (user: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [user]: !prev[user]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="flex gap-2">
              <Badge 
                variant={activeTab === 'teams' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setActiveTab('teams')}
              >
                Teams Management
              </Badge>
              <Badge 
                variant={activeTab === 'environments' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setActiveTab('environments')}
              >
                Environments
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={saveTeamsConfig} className="gap-2">
              <Database className="h-4 w-4" />
              Save Configuration
            </Button>
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'teams' && (
          <div className="space-y-8">
            {/* Add New Team */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Team
                </CardTitle>
                <CardDescription>
                  Create a new team with specific environment and namespace access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Team Name</label>
                    <Input
                      placeholder="Enter team name"
                      value={newTeam.name}
                      onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Users (comma-separated)</label>
                    <Input
                      placeholder="user1, user2, user3"
                      value={newTeam.users.join(', ')}
                      onChange={(e) => setNewTeam({ 
                        ...newTeam, 
                        users: e.target.value.split(',').map(u => u.trim()).filter(Boolean)
                      })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Environments</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {availableEnvironments.map(env => (
                        <Badge
                          key={env}
                          variant={(newTeam.environments as string[]).includes(env) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const envs = newTeam.environments as string[];
                            const updated = envs.includes(env)
                              ? envs.filter(e => e !== env)
                              : [...envs, env];
                            setNewTeam({ ...newTeam, environments: updated });
                          }}
                        >
                          {env}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => addTeam(newTeam.name)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Team
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Existing Teams */}
            <div className="grid gap-4">
              {Object.entries(teamsConfig.teams).map(([teamId, team]) => (
                <Card key={teamId} className={teamId === 'admin' ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {team.name}
                        </CardTitle>
                        {teamId === 'admin' && <Badge variant="destructive">Admin</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTeam(editingTeam === teamId ? null : teamId)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {teamId !== 'admin' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteTeam(teamId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingTeam === teamId ? (
                      <TeamEditForm
                        teamId={teamId}
                        team={team}
                        availableEnvironments={availableEnvironments}
                        availableNamespaces={availableNamespaces}
                        onSave={(updatedTeam) => updateTeam(teamId, updatedTeam)}
                        onCancel={() => setEditingTeam(null)}
                      />
                    ) : (
                      <div className="grid gap-4">
                        {/* Users */}
                        <div>
                          <label className="text-sm font-medium">Users & Credentials</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {team.users.map(user => (
                              <div key={user} className="flex items-center gap-2 bg-muted p-2 rounded">
                                <span className="text-sm font-medium">{user}</span>
                                <span className="text-xs text-muted-foreground">:</span>
                                <span className="text-xs font-mono">
                                  {showPasswords[user] 
                                    ? teamsConfig.credentials[user] 
                                    : '••••••••'
                                  }
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => togglePasswordVisibility(user)}
                                >
                                  {showPasswords[user] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Environments */}
                        <div>
                          <label className="text-sm font-medium">Environments</label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {team.environments === '*' ? (
                              <Badge variant="destructive">All Environments</Badge>
                            ) : (
                              (team.environments as string[]).map(env => (
                                <Badge key={env} variant="default">{env}</Badge>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Namespaces */}
                        <div>
                          <label className="text-sm font-medium">Namespaces</label>
                          <div className="mt-1">
                            {team.namespaces === '*' ? (
                              <Badge variant="destructive">All Namespaces</Badge>
                            ) : (
                              <div className="space-y-2">
                                {Object.entries(team.namespaces as Record<string, string[]>).map(([env, namespaces]) => (
                                  <div key={env} className="flex items-center gap-2">
                                    <Badge variant="outline">{env}:</Badge>
                                    <div className="flex flex-wrap gap-1">
                                      {namespaces.map(ns => (
                                        <Badge key={ns} variant="secondary" className="text-xs">{ns}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {team.dynamicNamespaceFiltering ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="bg-blue-500">Dynamic Filtering</Badge>
                                  <Badge variant="outline">Pattern: {team.namespacePattern || 'Not set'}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Shows namespaces containing "{team.namespacePattern}"
                                  {' '}anywhere in the name
                                </div>
                              </div>
                            ) : (
                              <></>
                            )}
                          </div>
                        </div>

                        {/* Container Path Restrictions */}
                        {(team.allowedPaths || team.blockedPaths) && (
                          <div>
                            <label className="text-sm font-medium">Path Restrictions</label>
                            <div className="mt-1 space-y-2">
                              {team.allowedPaths && team.allowedPaths.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-green-600">Allowed:</Badge>
                                  <div className="flex flex-wrap gap-1">
                                    {team.allowedPaths.map(path => (
                                      <Badge key={path} variant="secondary" className="text-xs text-green-600">{path}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {team.blockedPaths && team.blockedPaths.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-red-600">Blocked:</Badge>
                                  <div className="flex flex-wrap gap-1">
                                    {team.blockedPaths.map(path => (
                                      <Badge key={path} variant="secondary" className="text-xs text-red-600">{path}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'environments' && (
          <EnvironmentManagement 
            availableEnvironments={availableEnvironments}
            onEnvironmentAdded={() => loadAvailableEnvironments()}
          />
        )}
      </main>
    </div>
  );
}

// Team Edit Form Component
interface TeamEditFormProps {
  teamId: string;
  team: Team;
  availableEnvironments: string[];
  availableNamespaces: Record<string, string[]>;
  onSave: (team: Team) => void;
  onCancel: () => void;
}

function TeamEditForm({ teamId, team, availableEnvironments, availableNamespaces, onSave, onCancel }: TeamEditFormProps) {
  const [editedTeam, setEditedTeam] = useState<Team>({ ...team });

  const handleEnvironmentToggle = (env: string) => {
    if (editedTeam.environments === '*') return;
    
    const envs = editedTeam.environments as string[];
    const updated = envs.includes(env)
      ? envs.filter(e => e !== env)
      : [...envs, env];
    
    setEditedTeam({ 
      ...editedTeam, 
      environments: updated,
      // Remove namespaces for environments that are no longer selected
      namespaces: editedTeam.namespaces === '*' ? '*' : 
        Object.fromEntries(
          Object.entries(editedTeam.namespaces as Record<string, string[]>)
            .filter(([envName]) => updated.includes(envName))
        )
    });
  };

  const handleNamespaceToggle = (env: string, namespace: string) => {
    if (editedTeam.namespaces === '*') return;
    
    const namespaces = editedTeam.namespaces as Record<string, string[]>;
    const envNamespaces = namespaces[env] || [];
    const updated = envNamespaces.includes(namespace)
      ? envNamespaces.filter(ns => ns !== namespace)
      : [...envNamespaces, namespace];
    
    setEditedTeam({
      ...editedTeam,
      namespaces: {
        ...namespaces,
        [env]: updated
      }
    });
  };

  const handlePathChange = (type: 'allowedPaths' | 'blockedPaths', value: string) => {
    const paths = value.split(',').map(p => p.trim()).filter(Boolean);
    setEditedTeam({
      ...editedTeam,
      [type]: paths
    });
  };

  const handleDynamicNamespaceFilteringChange = (value: boolean) => {
    setEditedTeam({
      ...editedTeam,
      dynamicNamespaceFiltering: value,
      namespacePattern: value ? '' : undefined
    });
  };

  const handleNamespacePatternChange = (value: string) => {
    setEditedTeam({
      ...editedTeam,
      namespacePattern: value
    });
  };

  return (
    <div className="space-y-4">
      {/* Team Name */}
      <div>
        <label className="text-sm font-medium">Team Name</label>
        <Input
          value={editedTeam.name}
          onChange={(e) => setEditedTeam({ ...editedTeam, name: e.target.value })}
        />
      </div>

      {/* Users */}
      <div>
        <label className="text-sm font-medium">Users (comma-separated)</label>
        <Input
          value={editedTeam.users.join(', ')}
          onChange={(e) => setEditedTeam({ 
            ...editedTeam, 
            users: e.target.value.split(',').map(u => u.trim()).filter(Boolean)
          })}
        />
      </div>

      {/* Environments */}
      <div>
        <label className="text-sm font-medium">Environments</label>
        <div className="flex flex-wrap gap-2 mt-1">
          <Badge
            variant={editedTeam.environments === '*' ? "destructive" : "outline"}
            className="cursor-pointer"
            onClick={() => setEditedTeam({ 
              ...editedTeam, 
              environments: editedTeam.environments === '*' ? [] : '*',
              namespaces: editedTeam.environments === '*' ? {} : '*'
            })}
          >
            All Environments
          </Badge>
          {editedTeam.environments !== '*' && availableEnvironments.map(env => (
            <Badge
              key={env}
              variant={(editedTeam.environments as string[]).includes(env) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleEnvironmentToggle(env)}
            >
              {env}
            </Badge>
          ))}
        </div>
      </div>

      {/* Namespaces per Environment */}
      {editedTeam.environments !== '*' && (editedTeam.environments as string[]).length > 0 && (
        <div>
          <label className="text-sm font-medium">Namespace Restrictions</label>
          <div className="space-y-3 mt-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={editedTeam.namespaces === '*' ? "destructive" : "outline"}
                className="cursor-pointer"
                onClick={() => setEditedTeam({ 
                  ...editedTeam, 
                  namespaces: editedTeam.namespaces === '*' ? {} : '*'
                })}
              >
                All Namespaces
              </Badge>
            </div>
            
            {editedTeam.namespaces !== '*' && (editedTeam.environments as string[]).map(env => (
              <div key={env} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{env}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({availableNamespaces[env]?.length || 0} available)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableNamespaces[env]?.map(ns => (
                    <Badge
                      key={ns}
                      variant={
                        (editedTeam.namespaces as Record<string, string[]>)[env]?.includes(ns) 
                          ? "default" 
                          : "outline"
                      }
                      className="cursor-pointer text-xs"
                      onClick={() => handleNamespaceToggle(env, ns)}
                    >
                      {ns}
                    </Badge>
                  )) || <span className="text-sm text-muted-foreground">No namespaces available</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Namespace Filtering */}
      <div>
        <label className="text-sm font-medium">Dynamic Namespace Filtering</label>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant={editedTeam.dynamicNamespaceFiltering ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => handleDynamicNamespaceFilteringChange(!editedTeam.dynamicNamespaceFiltering)}
          >
            Enable
          </Button>
          {editedTeam.dynamicNamespaceFiltering && (
            <Input
              placeholder="Namespace pattern (regex)"
              value={editedTeam.namespacePattern || ''}
              onChange={(e) => handleNamespacePatternChange(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Container Path Restrictions */}
      <div>
        <label className="text-sm font-medium">Container Path Restrictions</label>
        <div className="space-y-2 mt-1">
          <div>
            <label className="text-xs text-muted-foreground">Allowed Paths (comma-separated)</label>
            <Input
              placeholder="/var/log, /app/logs, /tmp"
              value={editedTeam.allowedPaths?.join(', ') || ''}
              onChange={(e) => handlePathChange('allowedPaths', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Blocked Paths (comma-separated)</label>
            <Input
              placeholder="/etc, /root, /var/lib"
              value={editedTeam.blockedPaths?.join(', ') || ''}
              onChange={(e) => handlePathChange('blockedPaths', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => onSave(editedTeam)} className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Environment Management Component
interface EnvironmentManagementProps {
  availableEnvironments: string[];
  onEnvironmentAdded: () => void;
}

function EnvironmentManagement({ availableEnvironments, onEnvironmentAdded }: EnvironmentManagementProps) {
  const [kubeconfigFile, setKubeconfigFile] = useState<File | null>(null);
  const [environmentName, setEnvironmentName] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3006/api';

  const getSessionHeaders = () => {
    const sessionId = localStorage.getItem('sessionId');
    return {
      ...(sessionId && { 'x-session-id': sessionId })
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setKubeconfigFile(file);
      // Auto-generate environment name from filename
      const name = file.name.replace(/\.(yaml|yml|config)$/i, '');
      setEnvironmentName(name);
    }
  };

  const uploadKubeconfig = async () => {
    if (!kubeconfigFile || !environmentName) {
      toast({
        title: "Error",
        description: "Please select a kubeconfig file and provide an environment name",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('kubeconfig', kubeconfigFile);
      formData.append('environmentName', environmentName);

      const response = await fetch(`${API_BASE_URL}/admin/upload-kubeconfig`, {
        method: 'POST',
        headers: getSessionHeaders(),
        body: formData
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Environment '${environmentName}' added successfully`,
        });
        setKubeconfigFile(null);
        setEnvironmentName('');
        onEnvironmentAdded();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: `Failed to upload kubeconfig: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeEnvironment = async (envName: string) => {
    if (['sbx', 'dev', 'devint', 'qa', 'prod'].includes(envName)) {
      toast({
        title: "Error",
        description: "Cannot remove default environments",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/remove-environment/${envName}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getSessionHeaders()
        }
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Environment '${envName}' removed successfully`,
        });
        onEnvironmentAdded();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: `Failed to remove environment: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Add New Environment
          </CardTitle>
          <CardDescription>
            Upload a kubeconfig file to add a new Kubernetes environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Environment Name</label>
              <Input
                placeholder="e.g., staging, production, test"
                value={environmentName}
                onChange={(e) => setEnvironmentName(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Kubeconfig File</label>
              <Input
                type="file"
                accept=".yaml,.yml,.config"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {kubeconfigFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {kubeconfigFile.name}
                </p>
              )}
            </div>

            <Button 
              onClick={uploadKubeconfig} 
              disabled={!kubeconfigFile || !environmentName || uploading}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Add Environment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Environments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Existing Environments
          </CardTitle>
          <CardDescription>
            Manage your Kubernetes environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {availableEnvironments.map(env => (
              <div key={env} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{env}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {['sbx', 'dev', 'devint', 'qa', 'prod'].includes(env) ? 'Default Environment' : 'Custom Environment'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Download kubeconfig functionality
                      window.open(`${API_BASE_URL}/admin/download-kubeconfig/${env}`, '_blank');
                    }}
                    className="gap-2"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                  {!['sbx', 'dev', 'devint', 'qa', 'prod'].includes(env) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeEnvironment(env)}
                      className="gap-2"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment Configuration Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="font-medium">Kubeconfig Requirements:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Valid YAML format (.yaml, .yml, or .config extension)</li>
                <li>Contains cluster, user, and context information</li>
                <li>Certificates should be embedded or accessible</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium">Environment Naming:</h4>
              <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                <li>Use lowercase letters, numbers, and hyphens only</li>
                <li>Should be descriptive (e.g., staging, production, test)</li>
                <li>Avoid spaces and special characters</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
