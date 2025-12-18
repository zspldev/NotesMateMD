import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Download, Loader2 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ExportPDFDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

type PresetRange = "today" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

export default function ExportPDFDialog({ 
  open, 
  onOpenChange, 
  patientId,
  patientName 
}: ExportPDFDialogProps) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>("last30");

  const handlePresetChange = (preset: PresetRange) => {
    setSelectedPreset(preset);
    const today = new Date();
    
    switch (preset) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        break;
      case "last7":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case "last30":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
      case "lastMonth":
        const lastMonth = subMonths(today, 1);
        setStartDate(startOfMonth(lastMonth));
        setEndDate(endOfMonth(lastMonth));
        break;
    }
  };

  const formatDateForAPI = (date: Date): string => {
    return format(date, "yyyy-MM-dd");
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      // Get auth token from localStorage
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `/api/patients/${patientId}/notes/export?startDate=${startStr}&endDate=${endStr}`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${patientId}_Notes_${startStr}-${endStr}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Exported",
        description: `Notes for ${patientName} have been exported successfully.`,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Patient Notes to PDF</DialogTitle>
          <DialogDescription>
            Export clinical notes for {patientName} as a PDF document.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedPreset === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange("today")}
                data-testid="button-preset-today"
              >
                Today
              </Button>
              <Button
                type="button"
                variant={selectedPreset === "last7" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange("last7")}
                data-testid="button-preset-last7"
              >
                Last 7 Days
              </Button>
              <Button
                type="button"
                variant={selectedPreset === "last30" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange("last30")}
                data-testid="button-preset-last30"
              >
                Last 30 Days
              </Button>
              <Button
                type="button"
                variant={selectedPreset === "thisMonth" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange("thisMonth")}
                data-testid="button-preset-thismonth"
              >
                This Month
              </Button>
              <Button
                type="button"
                variant={selectedPreset === "lastMonth" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange("lastMonth")}
                data-testid="button-preset-lastmonth"
              >
                Last Month
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        setSelectedPreset("custom");
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setEndDate(date);
                        setSelectedPreset("custom");
                      }
                    }}
                    disabled={(date) => date > new Date() || date < startDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Selected range: {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            data-testid="button-cancel-export"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export-pdf"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
