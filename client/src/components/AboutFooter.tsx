import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function AboutFooter() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <footer className="py-4 text-center">
        <button
          onClick={() => setShowAbout(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          data-testid="button-about-footer"
        >
          © 2025, Zapurzaa Systems
        </button>
      </footer>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              About NotesMate MD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">App Name:</span>
              <span>NotesMate MD</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Version:</span>
              <Badge variant="secondary">Beta v0.9</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Release Date:</span>
              <span>20th December 2025</span>
            </div>
            <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This is a beta version for testing purposes. Not for use with real patient data.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
