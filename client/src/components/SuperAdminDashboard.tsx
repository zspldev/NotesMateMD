import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  UserRound,
  ClipboardList,
  LogIn,
  RefreshCw,
  Loader2,
  Plus,
  Pencil,
  Shield
} from "lucide-react";
import { api, type LoginResponse } from "../lib/api";
import AddOrganizationDialog from "./AddOrganizationDialog";
import EditOrganizationDialog from "./EditOrganizationDialog";

interface SuperAdminDashboardProps {
  loginData: LoginResponse;
  onSwitchOrg: (orgCode: string) => void;
}

interface Organization {
  orgid: string;
  org_number: number | null;
  org_shortname: string | null;
  org_name: string;
  org_type: string | null;
  is_active: boolean | null;
}

interface PlatformStats {
  totalPatients: number;
  totalEmployees: number;
  totalVisits: number;
  activeOrgs: number;
  inactiveOrgs: number;
}

export default function SuperAdminDashboard({ loginData, onSwitchOrg }: SuperAdminDashboardProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [orgs, platformStats] = await Promise.all([
        api.getOrganizations(),
        api.getPlatformStats()
      ]);
      setOrganizations(orgs.filter((org: Organization) => org.org_number !== 1001));
      setStats(platformStats);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginToOrg = (orgNumber: number) => {
    onSwitchOrg(orgNumber.toString());
  };

  const handleEditOrg = (org: Organization) => {
    setSelectedOrg(org);
    setShowEditDialog(true);
  };

  const getOrgTypeLabel = (type: string | null) => {
    switch (type) {
      case 'hospital': return 'Hospital';
      case 'clinic': return 'Clinic';
      case 'medical_office': return 'Medical Office';
      case 'urgent_care': return 'Urgent Care';
      case 'specialty': return 'Specialty Practice';
      default: return type || 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8" style={{ color: '#17a2b8' }} />
            <div>
              <CardTitle className="text-2xl">Super Admin Console</CardTitle>
              <CardDescription>
                Platform-wide administration and organization management
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-orgs">
              {stats?.activeOrgs ?? organizations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.inactiveOrgs ? `${stats.inactiveOrgs} inactive` : 'Active organizations'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-employees">
              {stats?.totalEmployees ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all organizations
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-patients">
              {stats?.totalPatients ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Registered in system
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-visits">
              {stats?.totalVisits ?? '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Patient encounters
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organizations
              </CardTitle>
              <CardDescription>
                Manage organizations and access their clinical data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={loadData}
                disabled={isLoading}
                data-testid="button-refresh-orgs"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={() => setShowAddDialog(true)}
                data-testid="button-add-org"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Organization
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              {error}
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No organizations found. Click "Add Organization" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.orgid}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`org-row-${org.org_number}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5" style={{ color: '#17a2b8' }} />
                    </div>
                    <div>
                      <div className="font-medium">{org.org_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Code: {org.org_number} • {org.org_shortname} • {getOrgTypeLabel(org.org_type)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditOrg(org)}
                      data-testid={`button-edit-org-${org.org_number}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => org.org_number && handleLoginToOrg(org.org_number)}
                      disabled={!org.is_active}
                      data-testid={`button-login-org-${org.org_number}`}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Enter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-start"
              onClick={() => setShowAddDialog(true)}
              data-testid="button-quick-add-org"
            >
              <div className="flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4" />
                Create Organization
              </div>
              <p className="text-xs text-muted-foreground mt-1">Add a new medical organization</p>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-start" disabled>
              <div className="flex items-center gap-2 font-medium">
                <Users className="h-4 w-4" />
                Manage Users
              </div>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AddOrganizationDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={loadData}
      />

      <EditOrganizationDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        organization={selectedOrg}
        onSuccess={loadData}
      />
    </div>
  );
}
