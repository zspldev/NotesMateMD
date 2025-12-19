import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  Plus,
  Pencil,
  KeyRound,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { api } from "../lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

async function authFetch(url: string, options: RequestInit = {}) {
  const token = api.getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

interface Employee {
  empid: string;
  orgid: string | null;
  username: string;
  first_name: string;
  last_name: string;
  title: string | null;
  role: string | null;
  secondary_role: string | null;
  is_active: boolean | null;
  created_at: Date | string | null;
}

interface EmployeeFormData {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  title: string;
  role: string;
  secondary_role: string;
}

const initialFormData: EmployeeFormData = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  title: "",
  role: "doctor",
  secondary_role: ""
};

export default function EmployeeManagement() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [newPassword, setNewPassword] = useState("");

  const { data: employees = [], isLoading, refetch } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      return await authFetch('/api/employees');
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      return await authFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          secondary_role: data.secondary_role || null
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowAddDialog(false);
      setFormData(initialFormData);
      toast({ title: "Employee created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create employee", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ empid, data }: { empid: string; data: Partial<EmployeeFormData> }) => {
      return await authFetch(`/api/employees/${empid}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          secondary_role: data.secondary_role || null
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setShowEditDialog(false);
      setSelectedEmployee(null);
      setFormData(initialFormData);
      toast({ title: "Employee updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update employee", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ empid, new_password }: { empid: string; new_password: string }) => {
      return await authFetch(`/api/employees/${empid}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password })
      });
    },
    onSuccess: () => {
      setShowPasswordDialog(false);
      setSelectedEmployee(null);
      setNewPassword("");
      toast({ title: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to reset password", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (empid: string) => {
      return await authFetch(`/api/employees/${empid}/toggle-active`, {
        method: 'POST'
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({ title: data.message || "Status updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update status", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const handleAddEmployee = () => {
    setFormData(initialFormData);
    setShowAddDialog(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      username: employee.username,
      password: "",
      first_name: employee.first_name,
      last_name: employee.last_name,
      title: employee.title || "",
      role: employee.role || "doctor",
      secondary_role: employee.secondary_role || ""
    });
    setShowEditDialog(true);
  };

  const handleResetPassword = (employee: Employee) => {
    setSelectedEmployee(employee);
    setNewPassword("");
    setShowPasswordDialog(true);
  };

  const handleToggleActive = (employee: Employee) => {
    toggleActiveMutation.mutate(employee.empid);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.first_name || !formData.last_name) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!formData.first_name || !formData.last_name) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      empid: selectedEmployee.empid,
      data: {
        first_name: formData.first_name,
        last_name: formData.last_name,
        title: formData.title,
        role: formData.role,
        secondary_role: formData.secondary_role
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    resetPasswordMutation.mutate({ empid: selectedEmployee.empid, new_password: newPassword });
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'org_admin': return 'bg-purple-600';
      case 'doctor': return 'bg-teal-600';
      case 'staff': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'org_admin': return 'Admin';
      case 'doctor': return 'Doctor';
      case 'staff': return 'Staff';
      default: return role || 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5" style={{ color: '#17a2b8' }} />
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your organization's employees</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh-employees"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={handleAddEmployee}
              style={{ backgroundColor: '#17a2b8' }}
              data-testid="button-add-employee"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#17a2b8' }} />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No employees found. Add your first team member to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => (
              <div
                key={employee.empid}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  employee.is_active === false ? 'opacity-60 bg-muted/50' : ''
                }`}
                data-testid={`employee-row-${employee.empid}`}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </span>
                      {employee.is_active === false && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      @{employee.username}
                      {employee.title && ` • ${employee.title}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Badge className={getRoleBadgeColor(employee.role)}>
                      {getRoleLabel(employee.role)}
                    </Badge>
                    {employee.secondary_role && (
                      <Badge variant="outline" className="text-xs">
                        +{getRoleLabel(employee.secondary_role)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditEmployee(employee)}
                      title="Edit employee"
                      data-testid={`button-edit-${employee.empid}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleResetPassword(employee)}
                      title="Reset password"
                      data-testid={`button-reset-password-${employee.empid}`}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(employee)}
                      title={employee.is_active ? "Deactivate" : "Activate"}
                      disabled={toggleActiveMutation.isPending}
                      data-testid={`button-toggle-active-${employee.empid}`}
                    >
                      {employee.is_active ? (
                        <UserX className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new team member account for your organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  data-testid="input-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., MD, RN, PA"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="org_admin">Organization Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_role">Secondary Role</Label>
                <Select
                  value={formData.secondary_role || "none"}
                  onValueChange={(value) => setFormData({ ...formData, secondary_role: value === "none" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-secondary-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                style={{ backgroundColor: '#17a2b8' }}
                data-testid="button-submit-create"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information. Username cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name">First Name *</Label>
                  <Input
                    id="edit_first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    data-testid="input-edit-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_last_name">Last Name *</Label>
                  <Input
                    id="edit_last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    data-testid="input-edit-last-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={formData.username} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_title">Title</Label>
                <Input
                  id="edit_title"
                  placeholder="e.g., MD, RN, PA"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="org_admin">Organization Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_secondary_role">Secondary Role</Label>
                <Select
                  value={formData.secondary_role || "none"}
                  onValueChange={(value) => setFormData({ ...formData, secondary_role: value === "none" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-edit-secondary-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                style={{ backgroundColor: '#17a2b8' }}
                data-testid="button-submit-edit"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedEmployee?.first_name} {selectedEmployee?.last_name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password *</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  data-testid="input-new-password"
                />
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>The employee will need to use this new password on their next login.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={resetPasswordMutation.isPending}
                style={{ backgroundColor: '#17a2b8' }}
                data-testid="button-submit-password"
              >
                {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
