import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { api } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, Loader2, Stethoscope } from "lucide-react";

interface AddOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddOrganizationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextOrgNumber, setNextOrgNumber] = useState<number | null>(null);

  const [orgShortname, setOrgShortname] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("clinic");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminHasClinicalAccess, setAdminHasClinicalAccess] = useState(true);

  useEffect(() => {
    if (open) {
      loadNextOrgNumber();
      resetForm();
    }
  }, [open]);

  const loadNextOrgNumber = async () => {
    try {
      const result = await api.getNextOrgNumber();
      setNextOrgNumber(result.nextOrgNumber);
    } catch (err) {
      console.error("Failed to load next org number:", err);
    }
  };

  const resetForm = () => {
    setOrgShortname("");
    setOrgName("");
    setOrgType("clinic");
    setAddress("");
    setPhone("");
    setAdminUsername("");
    setAdminPassword("");
    setAdminFirstName("");
    setAdminLastName("");
    setAdminHasClinicalAccess(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgShortname || !orgName) {
      toast({
        title: "Missing Required Fields",
        description: "Organization shortname and name are required.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[A-Z0-9]{1,6}$/i.test(orgShortname)) {
      toast({
        title: "Invalid Shortname",
        description: "Shortname must be 1-6 alphanumeric characters.",
        variant: "destructive",
      });
      return;
    }

    const hasAdminInfo = adminUsername || adminPassword || adminFirstName || adminLastName;
    if (hasAdminInfo && (!adminUsername || !adminPassword || !adminFirstName || !adminLastName)) {
      toast({
        title: "Incomplete Admin Info",
        description: "If creating an admin, all admin fields are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await api.createOrganization({
        org_shortname: orgShortname.toUpperCase(),
        org_name: orgName,
        org_type: orgType,
        address: address || undefined,
        phone: phone || undefined,
        admin_username: adminUsername || undefined,
        admin_password: adminPassword || undefined,
        admin_first_name: adminFirstName || undefined,
        admin_last_name: adminLastName || undefined,
        admin_has_clinical_access: adminHasClinicalAccess,
      });

      toast({
        title: "Organization Created",
        description: `${result.organization.org_name} (${result.organization.org_number}) has been created successfully.${result.admin ? ` Admin account: ${result.admin.username}` : ""}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Creation Failed",
        description: err.message || "Failed to create organization.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: "#17a2b8" }} />
            Add New Organization
          </DialogTitle>
          <DialogDescription>
            Create a new medical organization and optionally set up the first administrator.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-number">Organization ID</Label>
              <Input
                id="org-number"
                value={nextOrgNumber?.toString() || "Loading..."}
                disabled
                className="bg-muted"
                data-testid="input-org-number"
              />
              <p className="text-xs text-muted-foreground">Auto-generated</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-shortname">Short Name *</Label>
              <Input
                id="org-shortname"
                placeholder="NEWORG"
                value={orgShortname}
                onChange={(e) => setOrgShortname(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                data-testid="input-org-shortname"
              />
              <p className="text-xs text-muted-foreground">Max 6 alphanumeric chars</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name *</Label>
            <Input
              id="org-name"
              placeholder="New Medical Center"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              data-testid="input-org-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-type">Type</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger data-testid="select-org-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="medical_office">Medical Office</SelectItem>
                <SelectItem value="urgent_care">Urgent Care</SelectItem>
                <SelectItem value="specialty">Specialty Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Medical Ave"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                data-testid="input-org-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-org-phone"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" style={{ color: "#17a2b8" }} />
              <Label className="text-sm font-medium">First Organization Admin (Optional)</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-first-name">First Name</Label>
                <Input
                  id="admin-first-name"
                  placeholder="John"
                  value={adminFirstName}
                  onChange={(e) => setAdminFirstName(e.target.value)}
                  data-testid="input-admin-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-last-name">Last Name</Label>
                <Input
                  id="admin-last-name"
                  placeholder="Administrator"
                  value={adminLastName}
                  onChange={(e) => setAdminLastName(e.target.value)}
                  data-testid="input-admin-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username">Username</Label>
                <Input
                  id="admin-username"
                  placeholder="admin.neworg"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  data-testid="input-admin-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Temporary Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  data-testid="input-admin-password"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="admin-clinical-access"
                checked={adminHasClinicalAccess}
                onCheckedChange={(checked) => setAdminHasClinicalAccess(checked === true)}
                data-testid="checkbox-admin-clinical-access"
              />
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <Label 
                  htmlFor="admin-clinical-access" 
                  className="text-sm cursor-pointer"
                >
                  Also has clinical access (can see patients and notes)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !nextOrgNumber}
              data-testid="button-create-org"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
