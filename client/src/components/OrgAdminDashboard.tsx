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
  ArrowRightLeft
} from "lucide-react";
import { api, type LoginResponse } from "../lib/api";

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

export default function OrgAdminDashboard({ loginData, onSwitchRole }: OrgAdminDashboardProps) {
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

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
        totalEmployees: 1, // Would need API to count org employees
        totalVisits,
        totalNotes
      });
    } catch (err) {
      console.error('Failed to load org stats:', err);
      setError('Failed to load organization statistics. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
                  <Users className="h-5 w-5" style={{ color: '#17a2b8' }} />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  disabled
                  data-testid="button-manage-team"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team Members
                  <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
                </Button>
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
                {hasSecondaryRole && (
                  <Button 
                    className="w-full justify-start" 
                    variant="default"
                    onClick={handleSwitchToDoctor}
                    style={{ backgroundColor: '#17a2b8' }}
                    data-testid="button-clinical-mode"
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Enter Clinical Mode
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

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
