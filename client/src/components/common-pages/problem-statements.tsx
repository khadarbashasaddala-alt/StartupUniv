import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ProblemStatementForm } from "@/components/ProblemStatementForm";
import { ProblemStatementsList } from "@/components/ProblemStatementsList";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ProblemStatementsPage() {
  const { user } = useAuth();
  const isFounder = user?.role === "FOUNDER";
  const isMentor = user?.role === "MENTOR";
  const isAdmin = user?.role === "ADMIN";
  const [editingStatement, setEditingStatement] = useState<any | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const { data: statements } = useQuery<any[]>({
    queryKey: ["/api/problem-statements"],
    queryFn: async () => await apiRequest("GET", "/api/problem-statements"),
  });

  const myStatement = statements?.find((s) => s.createdBy === user?.id) || null;
  const canCreate = isAdmin || (!myStatement && (isFounder || isMentor));

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-tour="ps-page-heading">Problem Statements</h1>
            <p className="text-muted-foreground">
              {isFounder && "Submit and track your problem statements"}
              {isAdmin && "Review, publish, and upload problem statements"}
              {isMentor && !isAdmin && "Submit and track your problem statements"}
              {!isFounder && !isAdmin && !isMentor && "Browse published problem statements"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user?.role !== "COFOUNDER" && <PageTourButton pageKey={myStatement ? "problem-statements-created" : "problem-statements-empty"} />}
            {canCreate && isAdmin && (
              <Button
                onClick={() => {
                  setEditingStatement(null);
                  setShowForm(true);
                  setFormKey((k) => k + 1);
                }}
              >
                Upload Problem Statement
              </Button>
            )}
          </div>
        </div>

        {(isFounder || isAdmin || isMentor) ? (
          <div className="space-y-6">
            {(showForm || (!myStatement && (isFounder || isMentor))) ? (
              <ProblemStatementForm 
                key={formKey} 
                initialData={editingStatement || null} 
                isAdminDashboard={isAdmin}
                onSaved={() => {
                  setFormKey((k) => k + 1);
                  setEditingStatement(null);
                  setShowForm(false);
                }} 
              />
            ) : null}

            <ProblemStatementsList
              onEdit={(isFounder || isMentor || isAdmin) ? (stmt) => {
                setEditingStatement(stmt);
                setShowForm(true);
                setFormKey((k) => k + 1);
              } : undefined}
            />
          </div>
        ) : (
          <ProblemStatementsList />
        )}
      </div>
    </AppLayout>
  );
}
