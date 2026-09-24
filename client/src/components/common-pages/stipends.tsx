import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreditCard,
  IndianRupee,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageTourButton } from "@/components/tour/PageTourButton";

type StipendData = {
  band: string;
  monthlyAmount: string;
  totalReleased: number;
  nextDueDate: string | null;
  disbursements: {
    id: string;
    month: string;
    amount: string;
    status: string;
  }[];
};

export default function StipendsPage() {
  const { data: stipendData, isLoading } = useQuery<StipendData>({
    queryKey: ["/api/my-stipends"],
  });

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RELEASED":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Released
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "HOLD":
        return (
          <Badge className="bg-destructive/15 text-destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            On Hold
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getBandDescription = (band: string) => {
    switch (band) {
      case "A":
        return "Promoter - Highest responsibility tier";
      case "B":
        return "Co-Promoter - Leadership tier";
      case "C":
        return "Member - Core team tier";
      default:
        return "Team member";
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Stipends">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  const monthlyAmount = parseFloat(stipendData?.monthlyAmount || "0");
  const totalReleased = stipendData?.totalReleased || 0;
  const totalPending = (stipendData?.disbursements || [])
    .filter((d) => d.status === "PENDING")
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const totalHeld = (stipendData?.disbursements || [])
    .filter((d) => d.status === "HOLD")
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);

  const programTotal = monthlyAmount * 4;
  const progressPercent = programTotal > 0 ? (totalReleased / programTotal) * 100 : 0;

  return (
    <AppLayout title="Stipends">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Stipends</h1>
            <p className="text-muted-foreground">
              Track your monthly stipend disbursements
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PageTourButton pageKey="stipends" />
            <Badge variant="outline" className="text-lg px-3 py-1 border-border text-foreground">
              Band {stipendData?.band || "C"}
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4" data-tour="stipends-overview">
          <Card className="hover-elevate border-border bg-card" data-testid="stat-monthly">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Monthly Amount</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(monthlyAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {getBandDescription(stipendData?.band || "C")}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-border bg-card" data-testid="stat-released">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Total Released</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReleased)}</div>
              <p className="text-xs text-muted-foreground">
                Successfully disbursed
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-border bg-card" data-testid="stat-pending">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting release
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-border bg-card" data-testid="stat-held">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">On Hold</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(totalHeld)}</div>
              <p className="text-xs text-muted-foreground">
                Sprint gating applied
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-5 w-5" />
              Program Progress
            </CardTitle>
            <CardDescription>
              Your stipend disbursement progress over the 4-month program
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Released: {formatCurrency(totalReleased)}</span>
              <span>Target: {formatCurrency(programTotal)}</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-sm text-muted-foreground text-center">
              {progressPercent.toFixed(0)}% of program stipend released
            </p>
          </CardContent>
        </Card>

        {/* Disbursement History */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Wallet className="h-5 w-5" />
              Disbursement History
            </CardTitle>
            <CardDescription>
              Complete record of your stipend payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stipendData?.disbursements && stipendData.disbursements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stipendData.disbursements.map((disbursement) => (
                    <TableRow key={disbursement.id} data-testid={`disbursement-row-${disbursement.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatMonth(disbursement.month)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-4 w-4 text-muted-foreground" />
                          {formatCurrency(disbursement.amount)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(disbursement.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium text-foreground">No disbursements yet</p>
                <p className="text-sm mt-1">
                  Your stipend payments will appear here once sprints are completed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">How Stipends Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Badge className="bg-primary text-primary-foreground">Band A</Badge>
                  Promoter
                </h4>
                <p className="text-sm text-muted-foreground">
                  ₹25,000/month for team leaders with highest responsibility
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Badge className="bg-primary text-primary-foreground">Band B</Badge>
                  Co-Promoter
                </h4>
                <p className="text-sm text-muted-foreground">
                  ₹20,000/month for co-leads supporting team initiatives
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-foreground">
                  <Badge className="bg-primary text-primary-foreground">Band C</Badge>
                  Member
                </h4>
                <p className="text-sm text-muted-foreground">
                  ₹10,000/month for core team members
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
              <strong className="text-foreground">Sprint Gating:</strong> Stipends are released only when your team passes the current sprint review.
              Failed sprints result in stipends being held until the next successful sprint.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
