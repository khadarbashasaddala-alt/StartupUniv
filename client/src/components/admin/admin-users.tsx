import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Shield, ShieldOff, Users, Plus, Eye, Mail, Phone, Calendar, Bell, Trash2, Loader2, Tags } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRoles, ROLES_QUERY_KEY, type RoleOption } from "@/hooks/use-roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/use-view-mode";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  customTag?: string | null;
  createdAt: string;
}

const ROLE_CODE_PATTERN = /^[A-Z][A-Z_]*$/;

/**
 * Turns a typed role name into a storable code, e.g. "Guest Mentor" -> "GUEST_MENTOR".
 * Digits are dropped before separators are collapsed, so "Level 2 Mentor" yields
 * LEVEL_MENTOR rather than LEVEL__MENTOR — the server only accepts [A-Z_].
 */
function toRoleCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export default function AdminUsersPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Read role from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const initialRole = urlParams.get('role') || 'all';
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [viewMode, setViewMode] = useViewMode("admin-users-view");
  
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    userEmail: string;
  } | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showManageRolesDialog, setShowManageRolesDialog] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleInComposition, setNewRoleInComposition] = useState(true);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("LEARNER");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserCohortId, setNewUserCohortId] = useState("");
  const [shouldShake, setShouldShake] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());

  const { data: users, isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["/admin/users"],
    enabled: !!currentUser && !authLoading,
  });

  const { data: cohorts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/cohorts"],
    queryFn: () => apiRequest("GET", "/cohorts"),
    enabled: !!currentUser && !authLoading,
  });

  const { data: roles = [] } = useRoles(!!currentUser && !authLoading);

  const roleLabels = useMemo(
    () => new Map(roles.map((role) => [role.code, role.label])),
    [roles]
  );

  const createRoleMutation = useMutation({
    mutationFn: (data: { code: string; label: string; includeInComposition: boolean }) =>
      apiRequest("POST", "/admin/roles", data),
    onSuccess: (created: RoleOption) => {
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      setNewRoleLabel("");
      setNewRoleInComposition(true);
      toast({
        title: "Role added",
        description: `${created.label} is now available when creating users and planning cohorts.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not add role",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (code: string) => apiRequest("DELETE", `/admin/roles/${code}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY });
      toast({ title: "Role deleted" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not delete role",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const pendingRoleCode = toRoleCode(newRoleLabel);
  const pendingRoleError = (() => {
    if (!newRoleLabel.trim()) return null;
    if (pendingRoleCode.length < 2 || !ROLE_CODE_PATTERN.test(pendingRoleCode)) {
      return "Use letters only, e.g. Investor";
    }
    if (roleLabels.has(pendingRoleCode)) return `${pendingRoleCode} already exists`;
    return null;
  })();

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    createdAt: string;
  }[]>({
    queryKey: ["/admin/notifications/unread"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/admin/notifications/unread");
        return data;
      } catch (error: any) {
        console.error("Notifications fetch error:", error);
        return [];
      }
    },
    enabled: !!currentUser && !authLoading,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = notifications.length;
  const unreadNotificationIds = notifications
    .map((n) => n.id)
    .sort()
    .join(",");

  // Shake bell for 7 seconds only when new notifications arrive
  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    const currentNotificationSet = unreadNotificationIds;

    // Check if we have new notifications (count increased) or it's the first time
    const hasNewNotifications = previousCount !== null && unreadCount > previousCount;
    const isFirstTime = previousCount === null && unreadCount > 0;
    const hasNewNotificationIds = !hasShakenForCurrentNotificationsRef.current.has(currentNotificationSet);

    if ((isFirstTime || hasNewNotifications || hasNewNotificationIds) && unreadCount > 0) {
      setShouldShake(true);
      hasShakenForCurrentNotificationsRef.current.add(currentNotificationSet);
      
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }

    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount, unreadNotificationIds]);

  

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users"] });
      toast({
        title: "User deleted successfully",
        description: "The user and all associated data have been permanently deleted.",
      });
      setDeleteDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete user",
        description: error.message || "An error occurred while deleting the user.",
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string; phone?: string; cohortId?: string }) => {
      return apiRequest("POST", "/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/admin/stats"] });
      toast({
        title: "User created successfully",
        description: "The new user has been added to the platform.",
      });
      setShowCreateUserDialog(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("LEARNER");
      setNewUserPhone("");
      setNewUserCohortId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword || !newUserRole) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      phone: newUserPhone || undefined,
      cohortId: newUserCohortId || undefined,
    });
  };

  const filteredUsers = users?.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = selectedRole === "all" || u.role === selectedRole;
    
    return matchesSearch && matchesRole;
  });

  

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "default";
      case "MENTOR":
        return "secondary";
      case "LEARNER":
        return "outline";
      default:
        return "outline";
    }
  };

  const adminCount = users?.filter((u) => u.role === "ADMIN").length || 0;
  const totalUsers = users?.length || 0;

  // Check if current user has admin access
  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <AppLayout title="Access Denied">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="User Privileges"
      headerAction={
        <Button
          variant="outline"
          size="icon"
          className="relative h-14 w-14 bg-card backdrop-blur-xl border border-border hover:border-primary/50"
          onClick={() => setLocation("/app/admin/notifications")}
        >
          <Bell className={`h-9 w-9 text-primary ${shouldShake ? 'animate-shake' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      }
    >
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-2xl rounded-2xl hover:shadow-2xl transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : totalUsers}</div>
            <p className="text-xs text-muted-foreground">Platform users</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-2xl rounded-2xl hover:shadow-2xl transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : adminCount}</div>
            <p className="text-xs text-muted-foreground">Users with admin privileges</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Card View */}
      <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <CardHeader className="relative">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-foreground">Manage Users</CardTitle>
              <CardDescription className="text-muted-foreground">
                Create new users and manage user privileges
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateUserDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
              <ViewToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Role Filter Tabs */}
          <Tabs value={selectedRole} onValueChange={setSelectedRole} className="mb-6">
            <TabsList className="grid w-full bg-muted/50 border border-border" style={{ gridTemplateColumns: `repeat(${roles.length + 1}, minmax(0, 1fr))` }}>
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
              >
                All
              </TabsTrigger>
              {roles.map((role) => (
                <TabsTrigger
                  key={role.code}
                  value={role.code}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                >
                  {role.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {error && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm font-medium text-destructive">Error loading users</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error.message || "Please check console for details. You may need to log out and log back in."}
              </p>
            </div>
          )}
          
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No users found in the system.</p>
              <Button onClick={() => setShowCreateUserDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First User
              </Button>
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            viewMode === "table" ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium text-foreground">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                              <Phone className="h-3 w-3 shrink-0" />
                              {user.phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {roleLabels.get(user.role) ?? user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.customTag ? (
                            <Badge className="gap-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                              <Tags className="h-3 w-3" />
                              {user.customTag}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role === "ADMIN" ? (
                            <Badge className="gap-1 bg-primary">
                              <Shield className="h-3 w-3" />
                              Admin
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => setLocation(`/app/admin/users/${user.id}`)}
                              aria-label={`View ${user.name}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                setDeleteDialog({
                                  open: true,
                                  userId: user.id,
                                  userName: user.name,
                                  userEmail: user.email,
                                })
                              }
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-${user.id}`}
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid={`card-user-${user.id}`}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                  <CardHeader className="relative">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg text-foreground">{user.name}</CardTitle>
                        <CardDescription className="mt-1 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="text-xs">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              <span className="text-xs">{user.phone}</span>
                            </div>
                          )}
                        </CardDescription>
                      </div>
                      <div className="ml-2 flex flex-col items-end gap-1">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {roleLabels.get(user.role) ?? user.role}
                        </Badge>
                        {user.customTag && (
                          <Badge className="gap-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                            <Tags className="h-3 w-3" />
                            {user.customTag}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Admin Status */}
                    <div className="flex items-center gap-2">
                      {user.role === "ADMIN" ? (
                        <Badge className="gap-1 bg-primary">
                          <Shield className="h-3 w-3" />
                          Primary Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">No admin access</span>
                      )}
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-primary text-primary hover:bg-primary/10"
                        onClick={() => setLocation(`/app/admin/users/${user.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-none"
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            userId: user.id,
                            userName: user.name,
                            userEmail: user.email,
                          })
                        }
                        disabled={deleteUserMutation.isPending}
                        data-testid={`button-delete-${user.id}`}
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>


                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your search or filter.
            </div>
          )}
        </CardContent>
      </Card>

      

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog?.open || false}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog?.userName}</strong> ({deleteDialog?.userEmail})?
              <br /><br />
              <strong className="text-primary">This action cannot be undone.</strong> All user data including:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>User account and profile</li>
                <li>Tasks and assignments</li>
                <li>Evidence and submissions</li>
                <li>Notifications and sessions</li>
                <li>All related records</li>
              </ul>
              will be permanently deleted from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate(deleteDialog!.userId)}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the platform. They will be able to log in with the provided credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={newUserRole} onValueChange={(value: any) => setNewUserRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.code} value={role.code}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 1234567890"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cohort">Cohort (Optional)</Label>
              <Select value={newUserCohortId} onValueChange={setNewUserCohortId}>
                <SelectTrigger id="cohort">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts?.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={showManageRolesDialog} onOpenChange={setShowManageRolesDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              A role added here becomes available when creating a user and, if included in
              composition, when planning a cohort's headcount.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-role-label">Role name *</Label>
              <Input
                id="new-role-label"
                placeholder="e.g. Investor"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pendingRoleError && newRoleLabel.trim()) {
                    createRoleMutation.mutate({
                      code: pendingRoleCode,
                      label: newRoleLabel.trim(),
                      includeInComposition: newRoleInComposition,
                    });
                  }
                }}
              />
              {pendingRoleError ? (
                <p className="text-xs text-destructive">{pendingRoleError}</p>
              ) : pendingRoleCode ? (
                <p className="text-xs text-muted-foreground">
                  Stored as <span className="font-mono">{pendingRoleCode}</span>
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="new-role-composition"
                checked={newRoleInComposition}
                onCheckedChange={(checked) => setNewRoleInComposition(checked === true)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="new-role-composition" className="font-normal">
                  Include in cohort composition
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adds a headcount field for this role to every cohort form.
                </p>
              </div>
            </div>

            <Button
              className="w-fit"
              disabled={
                !newRoleLabel.trim() || !!pendingRoleError || createRoleMutation.isPending
              }
              onClick={() =>
                createRoleMutation.mutate({
                  code: pendingRoleCode,
                  label: newRoleLabel.trim(),
                  includeInComposition: newRoleInComposition,
                })
              }
            >
              {createRoleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Role
            </Button>

            <div className="grid gap-1 border-t pt-4">
              <Label className="text-xs uppercase text-muted-foreground">
                Existing roles ({roles.length})
              </Label>
              <div className="max-h-56 overflow-y-auto">
                {roles.map((role) => (
                  <div
                    key={role.code}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{role.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {role.code}
                      </span>
                      {role.includeInComposition && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          in composition
                        </Badge>
                      )}
                    </div>
                    {role.isSystem ? (
                      // Built-in roles have route guards and dashboards keyed to them
                      <span className="shrink-0 text-xs text-muted-foreground">Built-in</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        disabled={deleteRoleMutation.isPending}
                        onClick={() => deleteRoleMutation.mutate(role.code)}
                        aria-label={`Delete ${role.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageRolesDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
    );
}
