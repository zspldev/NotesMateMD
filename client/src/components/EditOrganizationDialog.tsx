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
import { Switch } from "@/components/ui/switch";
import { api } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2 } from "lucide-react";

interface Organization {
  orgid: string;
  org_number: number | null;
  org_shortname: string | null;
  org_name: string;
  org_type: string | null;
  address?: string | null;
  phone?: string | null;
  is_active: boolean | null;
}

interface EditOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  onSuccess: () => void;
}

export default function EditOrganizationDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: EditOrganizationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("clinic");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (organization && open) {
      setOrgName(organization.org_name || "");
      setOrgType(organization.org_type || "clinic");
      setAddress((organization as any).address || "");
      setPhone((organization as any).phone || "");
      setIsActive(organization.is_active !== false);
    }
  }, [organization, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organization) return;

    if (!orgName) {
      toast({
        title: "Missing Required Field",
        description: "Organization name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.updateOrganization(organization.orgid, {
        org_name: orgName,
        org_type: orgType,
        address: address || undefined,
        phone: phone || undefined,
        is_active: isActive,
      });

      toast({
        title: "Organization Updated",
        description: `${orgName} has been updated successfully.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update organization.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" style={{ color: "#17a2b8" }} />
            Edit Organization
          </DialogTitle>
          <DialogDescription>
            Update organization details for {organization.org_shortname} ({organization.org_number})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization ID</Label>
              <Input
                value={organization.org_number?.toString() || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input
                value={organization.org_shortname || ""}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-name">Organization Name *</Label>
            <Input
              id="edit-org-name"
              placeholder="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              data-testid="input-edit-org-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-type">Type</Label>
            <Select value={orgType} onValueChange={setOrgType}>
              <SelectTrigger data-testid="select-edit-org-type">
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
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                placeholder="123 Medical Ave"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                data-testid="input-edit-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-edit-phone"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="is-active" className="text-base">Active Status</Label>
              <p className="text-sm text-muted-foreground">
                Inactive organizations cannot be accessed by users
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid="switch-is-active"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="button-save-org"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
