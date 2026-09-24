import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";

export interface ProblemStatementOverview {
  id: string;
  title: string;
  overview: string | null;
}

interface ProblemStatementOverviewModalProps {
  open: boolean;
  onClose: () => void;
  problemStatement: ProblemStatementOverview | null;
  founderName?: string;
}

export function ProblemStatementOverviewModal({
  open,
  onClose,
  problemStatement,
  founderName,
}: ProblemStatementOverviewModalProps) {
  if (!problemStatement) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Problem statement overview
          </DialogTitle>
          {founderName && (
            <DialogDescription>
              From {founderName}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-muted-foreground mb-1">Title</p>
            <p className="text-foreground">{problemStatement.title}</p>
          </div>
          {problemStatement.overview && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Overview</p>
              <p className="text-foreground whitespace-pre-wrap">{problemStatement.overview}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
