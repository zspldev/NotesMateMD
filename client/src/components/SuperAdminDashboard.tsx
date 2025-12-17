import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Settings,
  Shield,
  LogIn,
  RefreshCw,
  Loader2
} from "lucide-react";
import { api, type LoginResponse } from "../lib/api";

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

export default function SuperAdminDashboard({ loginData, onSwitchOrg }: SuperAdminDashboardProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    setError("");
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs.filter((org: Organization) => org.org_number !== 1001));
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError('Failed to load organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginToOrg = (orgNumber: number) => {
    onSwitchOrg(orgNumber.toString());
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-elevate cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
            <p className="text-xs text-muted-foreground">
              Active medical organizations
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Super Admin</div>
            <p className="text-xs text-muted-foreground">
              Full platform access
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">System Org</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">ZSPL</div>
            <p className="text-xs text-muted-foreground">
              Zapurzaa Systems
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organizations
              </CardTitle>
              <CardDescription>
                Login to an organization to access its patients and clinical data
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={loadOrganizations}
              disabled={isLoading}
              data-testid="button-refresh-orgs"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
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
              No organizations found
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
                        Code: {org.org_number} • {org.org_shortname}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
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
            <Button variant="outline" className="h-auto py-4 flex flex-col items-start" disabled>
              <div className="flex items-center gap-2 font-medium">
                <Building2 className="h-4 w-4" />
                Create Organization
              </div>
              <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
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
    </div>
  );
}
