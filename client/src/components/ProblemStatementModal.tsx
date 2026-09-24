import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function ProblemStatementModal({ open, onClose, statement }: { open: boolean; onClose: () => void; statement: any | null }) {
  if (!open || !statement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 max-w-3xl w-full mx-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl">{statement.title}</CardTitle>
              </div>
              <div>
                <Button variant="ghost" onClick={onClose} aria-label="Close">
                  <X />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">By {statement.creator?.name || statement.createdBy}</p>
                <p className="text-sm text-muted-foreground">Submitted {new Date(statement.createdAt).toLocaleDateString()}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Overview</h3>
                <p className="whitespace-pre-wrap">{statement.overview}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
