import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { insertPatientSchema, type InsertPatient } from "@shared/schema";

// Extend the schema with additional validation for form fields
const newPatientFormSchema = insertPatientSchema.extend({
  date_of_birth: z.string()
    .min(1, "Date of birth is required")
    .refine((date) => {
      const d = new Date(date);
      return !isNaN(d.getTime()) && d <= new Date();
    }, "Must be a valid date in the past"),
});

type NewPatientFormValues = z.infer<typeof newPatientFormSchema>;

interface NewPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatePatient: (patient: NewPatientFormValues) => Promise<void>;
  orgId: string;
}

export default function NewPatientDialog({
  open,
  onOpenChange,
  onCreatePatient,
  orgId,
}: NewPatientDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<NewPatientFormValues>({
    resolver: zodResolver(newPatientFormSchema),
    defaultValues: {
      orgid: orgId,
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: undefined,
      contact_info: undefined,
    },
  });

  const handleSubmit = async (values: NewPatientFormValues) => {
    setIsSubmitting(true);
    try {
      await onCreatePatient(values);
      // Reset form with orgId preserved
      form.reset({
        orgid: orgId,
        first_name: "",
        last_name: "",
        date_of_birth: "",
        gender: undefined,
        contact_info: undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create patient:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-new-patient">
        <DialogHeader>
          <DialogTitle>Create New Patient</DialogTitle>
          <DialogDescription>
            Enter patient information to create a new medical record.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Hidden field for orgid */}
            <input type="hidden" {...form.register("orgid")} value={orgId} />
            
            <div className="text-sm text-muted-foreground mb-4">
              Medical Record Number (MRN) will be automatically assigned.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Doe"
                        {...field}
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="DD/MM/YYYY"
                        {...field}
                        data-testid="input-dob"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Format: DD/MM/YYYY</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contact_info"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Information (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Phone: (555) 123-4567&#10;Email: patient@example.com&#10;Address: 123 Main St, City, State"
                      {...field}
                      value={field.value || ""}
                      rows={3}
                      data-testid="input-contact-info"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
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
                disabled={isSubmitting}
                data-testid="button-submit"
                style={{ backgroundColor: '#17a2b8' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Patient"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
