import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  UserRound,
  ClipboardList,
  RefreshCw,
  Loader2,
  Settings,
  Stethoscope,
  ArrowRightLeft,
  Download,
  HardDrive,
  FileDown,
  Clock
} from "lucide-react";
import { api, type LoginResponse } from "../lib/api";
import { format } from "date-fns";
import EmployeeManagement from "./EmployeeManagement";

interface OrgAdminDashboardProps {
  loginData: LoginResponse;
  onSwitchRole?: (role: string) => void;
}

interface OrgStats {
  totalPatients: number;
  totalEmployees: number;
  totalVisits: number;
  totalNotes: number;
}

interface BackupLog {
  backup_id: string;
  orgid: string;
  created_by_empid: string;
  backup_type: string | null;
  file_size_bytes: number | null;
  patient_count: number | null;
  visit_count: number | null;
  note_count: number | null;
  status: string | null;
  error_message: string | null;
  created_at: Date | string | null;
}

export default function OrgAdminDashboard({ loginData, onSwitchRole }: OrgAdminDashboardProps) {
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const hasSecondaryRole = loginData.employee.secondary_role === 'doctor';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const orgid = loginData.organization?.orgid;
      if (!orgid) {
        setError('No organization context');
        setIsLoading(false);
        return;
      }
      
      const patients = await api.getPatients(orgid);
      
      // Fetch employee count
      let totalEmployees = 0;
      try {
        const empResponse = await fetch('/api/employees', {
          headers: { 'Authorization': `Bearer ${api.getAccessToken()}` }
        });
        if (empResponse.ok) {
          const employees = await empResponse.json();
          totalEmployees = employees.length;
        }
      } catch (e) {
        console.warn('Could not fetch employee count');
      }
      
      // Calculate stats from patients
      let totalVisits = 0;
      let totalNotes = 0;
      
      // Fetch visits for each patient to count them
      const visitPromises = patients.map(p => api.getPatientVisits(p.patientid));
      const allVisits = await Promise.all(visitPromises);
      
      allVisits.forEach(visits => {
        totalVisits += visits.length;
        visits.forEach(v => {
          totalNotes += v.notes?.length || 0;
        });
      });
      
      setStats({
        totalPatients: patients.length,
        totalEmployees,
        totalVisits,
        totalNotes
      });
      
      // Load backup logs
      await loadBackupLogs();
    } catch (err) {
      console.error('Failed to load org stats:', err);
      setError('Failed to load organization statistics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadBackupLogs = async () => {
    try {
      const response = await fetch('/api/backups/logs', {
        headers: {
          'Authorization': `Bearer ${api.getAccessToken()}`
        }
      });
      if (response.ok) {
        const logs = await response.json();
        setBackupLogs(logs);
      }
    } catch (err) {
      console.error('Failed to load backup logs:', err);
    }
  };
  
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/backups/export', {
        headers: {
          'Authorization': `Bearer ${api.getAccessToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'backup.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Refresh backup logs
      await loadBackupLogs();
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export backup. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSwitchToDoctor = () => {
    if (onSwitchRole) {
      onSwitchRole('doctor');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8" style={{ color: '#17a2b8' }} />
              <div>
                <CardTitle className="text-2xl">Organization Admin</CardTitle>
                <CardDescription>
                  {loginData.organization?.org_name || 'Organization'} - Management Dashboard
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasSecondaryRole && (
                <Button
                  variant="outline"
                  onClick={handleSwitchToDoctor}
                  className="gap-2"
                  data-testid="button-switch-to-doctor"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Switch to Clinical View
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={loadData}
                disabled={isLoading}
                data-testid="button-refresh-stats"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#17a2b8' }} />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-employees">
                  {stats?.totalEmployees ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active staff members
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Patients</CardTitle>
                <UserRound className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-patients">
                  {stats?.totalPatients ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Registered patients
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Visits</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-visits">
                  {stats?.totalVisits ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total patient visits
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Clinical Notes</CardTitle>
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-notes">
                  {stats?.totalNotes ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Documented notes
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: '#17a2b8' }} />
                  Organization Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{loginData.organization?.org_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Code</p>
                    <p className="font-medium">{loginData.organization?.org_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Short Name</p>
                    <p className="font-medium">{loginData.organization?.org_shortname || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <Badge variant="secondary">
                      {loginData.organization?.org_type || 'General'}
                    </Badge>
                  </div>
                </div>
                {loginData.organization?.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{loginData.organization.address}</p>
                  </div>
                )}
                {loginData.organization?.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{loginData.organization.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" style={{ color: '#17a2b8' }} />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  disabled
                  data-testid="button-org-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Organization Settings
                  <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Employee Management Section */}
          <EmployeeManagement />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" style={{ color: '#17a2b8' }} />
                  Data Backup & Export
                </CardTitle>
                <Button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  style={{ backgroundColor: '#17a2b8' }}
                  data-testid="button-export-backup"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? 'Exporting...' : 'Export Backup'}
                </Button>
              </div>
              <CardDescription>
                Export your organization's data for backup or compliance purposes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backupLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No backups have been created yet. Click "Export Backup" to create your first backup.</p>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Recent Backup History</h4>
                  <div className="space-y-2">
                    {backupLogs.slice(0, 5).map((log) => (
                      <div 
                        key={log.backup_id} 
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`backup-log-${log.backup_id}`}
                      >
                        <div className="flex items-center gap-3">
                          <FileDown className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {log.backup_type === 'full_export' ? 'Full Export' : log.backup_type}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {log.created_at ? format(new Date(log.created_at), 'MMM d, yyyy h:mm a') : 'Unknown'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs text-muted-foreground">
                            <div>{formatFileSize(log.file_size_bytes)}</div>
                            <div>
                              {log.patient_count ?? 0} patients, {log.note_count ?? 0} notes
                            </div>
                          </div>
                          <Badge 
                            variant={log.status === 'completed' ? 'default' : 'destructive'}
                            className={log.status === 'completed' ? 'bg-green-600' : ''}
                          >
                            {log.status || 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Role</CardTitle>
              <CardDescription>
                Current permissions and access level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge style={{ backgroundColor: '#17a2b8', color: 'white' }}>
                    Organization Admin
                  </Badge>
                  <span className="text-sm text-muted-foreground">Primary Role</span>
                </div>
                {hasSecondaryRole && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      Doctor
                    </Badge>
                    <span className="text-sm text-muted-foreground">Secondary Role</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                As an Organization Admin, you can manage team members, view organization statistics, 
                and configure organization settings.
                {hasSecondaryRole && ' You can also switch to Clinical View to perform clinical work.'}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
