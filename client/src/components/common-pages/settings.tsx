import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Settings,
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  Moon,
  Sun,
  Palette,
  Lock,
  Save,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  HelpCircle,
  Navigation,
} from "lucide-react";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTheme, PALETTES } from "@/components/theme-provider";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme, palette, setPalette } = useTheme();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
    // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
    // Avatar state
  const [avatarObjectKey, setAvatarObjectKey] = useState<string>("");
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const userId = user?.id || "";

  // Tour settings state
  const [tourButtonsEnabled, setTourButtonsEnabled] = useState(() => {
    const id = user?.id || "";
    return id ? localStorage.getItem(`sv_tour_buttons_disabled_${id}`) !== "true" : true;
  });

  // Co-founder tour settings state
  const [cofounderPlatformTourEnabled, setCofounderPlatformTourEnabled] = useState(() => {
    return localStorage.getItem("sv_cofounder_platform_tour_disabled") !== "true";
  });
  const [cofounderPageGuideEnabled, setCofounderPageGuideEnabled] = useState(() => {
    const id = user?.id || "";
    return id ? localStorage.getItem(`sv_tour_buttons_disabled_${id}`) !== "true" : true;
  });
  const [mentorPlatformTourEnabled, setMentorPlatformTourEnabled] = useState(() => {
    const id = user?.id || "";
    return id ? localStorage.getItem(`sv_platform_tour_disabled_${id}`) !== "true" : true;
  });
  const [mentorPageGuideEnabled, setMentorPageGuideEnabled] = useState(() => {
    const id = user?.id || "";
    return id ? localStorage.getItem(`sv_tour_buttons_disabled_${id}`) !== "true" : true;
  });

  useEffect(() => {
    if (!userId) return;
    setMentorPlatformTourEnabled(localStorage.getItem(`sv_platform_tour_disabled_${userId}`) !== "true");
    setMentorPageGuideEnabled(localStorage.getItem(`sv_tour_buttons_disabled_${userId}`) !== "true");
  }, [userId]);

  // Get avatar URL and profile (includes passwordChangedAt) for current user
  const { data: profileDetailed, isLoading: isLoadingProfile, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/auth/profile/detailed"],
    queryFn: async () => {
      console.log("[Settings] Fetching profile detailed data...");
      try {
        const data = await apiRequest("GET", "/api/auth/profile/detailed");
        console.log("[Settings] Profile detailed data received:", JSON.stringify(data, null, 2));
        console.log("[Settings] preferredTrack:", data?.preferredTrack, "type:", typeof data?.preferredTrack);
        console.log("[Settings] domain:", data?.domain, "type:", typeof data?.domain);
        console.log("[Settings] All keys in response:", Object.keys(data || {}));
        return data;
      } catch (error) {
        console.error("[Settings] Error fetching profile:", error);
        throw error;
      }
    },
    enabled: !!user?.id,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  
  // Debug logging
  useEffect(() => {
    console.log("[Settings] User:", user?.id);
    console.log("[Settings] Profile detailed:", profileDetailed);
    console.log("[Settings] Is loading:", isLoadingProfile);
    console.log("[Settings] Error:", profileError);
    if (profileDetailed) {
      console.log("[Settings] preferredTrack value:", profileDetailed.preferredTrack);
      console.log("[Settings] domain value:", profileDetailed.domain);
    }
  }, [user?.id, profileDetailed, isLoadingProfile, profileError]);
  
  // Refetch when user changes
  useEffect(() => {
    if (user?.id) {
      console.log("[Settings] User ID changed, refetching profile...");
      refetchProfile();
    }
  }, [user?.id, refetchProfile]);
  const userAvatar = profileDetailed?.avatarUrl ?? null;
  const passwordChangedAt = profileDetailed?.passwordChangedAt ?? null;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; phone?: string; avatarUrl?: string }) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
      return response;
    },
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile/detailed"] });
      toast({ title: "Profile updated", description: "Your profile has been updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/users/change-password", data);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/profile/detailed"] });
      setShowChangePassword(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      const message = error.message || "Failed to change password";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    if (isEditMode) {
      updateProfileMutation.mutate({ 
        name, 
        phone: phone || undefined,
        avatarUrl: avatarObjectKey || undefined 
      });
      setIsEditMode(false);
    }
  };

  const handleAvatarUpload = async (objectKey: string) => {
    try {
      // Validate objectKey
      if (!objectKey || typeof objectKey !== "string" || objectKey.trim().length === 0) {
        throw new Error("Invalid file key. Please try uploading again.");
      }
      
      // Automatically update avatarUrl in database using existing profile update endpoint
      await apiRequest("PATCH", "/api/auth/profile", { avatarUrl: objectKey.trim() });
      
      // Store the objectKey and refresh user data
      setAvatarObjectKey(objectKey);
      
      // Get signed URL immediately for display
      try {
        const avatarData = await apiRequest("POST", "/api/auth/profile/avatar-url", { objectKey });
        // Update query cache immediately with the new avatar URL
        queryClient.setQueryData(["user-avatar", user?.id, objectKey], avatarData.fileUrl);
      } catch (urlError) {
        console.error("Error getting avatar URL:", urlError);
      }
      
      // Refresh user data to update avatarUrl in user object
      await refreshUser();
      
      // Invalidate avatar query to refetch with new avatarUrl
      queryClient.invalidateQueries({ queryKey: ["user-avatar"] });
      
      setShowAvatarUpload(false);
      toast({ 
        title: "Avatar uploaded", 
        description: "Your profile picture has been uploaded and saved successfully." 
      });
    } catch (error: any) {
      console.error("Error updating avatar:", error);
      toast({ 
        title: "Upload failed", 
        description: error.message || "Failed to save avatar. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: "Error", description: "Please fill in all password fields", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters long", variant: "destructive" });
      return;
    }

    if (!/(?=.*\d)/.test(newPassword)) {
      toast({ title: "Error", description: "Password must contain at least one number", variant: "destructive" });
      return;
    }

    if (!/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(newPassword)) {
      toast({ title: "Error", description: "Password must contain at least one special character", variant: "destructive" });
      return;
    }

    changePasswordMutation.mutate({ oldPassword, newPassword });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "MENTOR":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "LEARNER":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "UNIVERSITY":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "CORPORATE":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "";
    }
  };

  return (
    <AppLayout title="Settings">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>
          {user?.role !== "COFOUNDER" && <PageTourButton pageKey="settings" />}
        </div>

        {/* Profile Section */}
        <Card data-tour="settings-profile">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal details and contact information
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isEditMode) {
                    // Cancel edit - reset values
                    setName(user?.name || "");
                    setPhone(user?.phone || "");
                    setIsEditMode(false);
                  } else {
                    setIsEditMode(true);
                  }
                }}
              >
                {isEditMode ? "Cancel" : "Edit"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {userAvatar ? (
                    <AvatarImage src={userAvatar} alt="Profile picture" />
                  ) : null}
                  <AvatarFallback className="text-xl">
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <Dialog open={showAvatarUpload} onOpenChange={setShowAvatarUpload}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    >
                      <Upload className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Upload Profile Picture</DialogTitle>
                      <DialogDescription>
                        Choose a profile picture to upload. This will be visible to other users.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <ObjectUploader
                        onGetUploadParameters={async (file) => {
                          console.log("📋 Requesting upload URL for avatar:", { 
                            fileName: file.name, 
                            fileType: file.type 
                          });
                          
                          const data = await apiRequest("POST", "/api/users/avatar/upload-url", {
                            fileName: file.name,
                            fileType: file.type,
                          });
                          
                          console.log("✅ Got avatar upload URL:", data.uploadURL?.substring(0, 100));
                          console.log("✅ Got objectKey:", data.objectKey);
                          
                          // Store the objectKey for later use
                          setAvatarObjectKey(data.objectKey);
                          
                          return { 
                            method: "PUT" as const, 
                            url: data.uploadURL,
                            objectKey: data.objectKey,
                          };
                        }}
                        onComplete={(fileUrl, objectKey) => {
                          console.log("✅ Avatar upload complete, GET URL:", fileUrl);
                          console.log("✅ Avatar upload complete, objectKey:", objectKey);
                          if (objectKey) {
                            handleAvatarUpload(objectKey);
                          } else {
                            console.error("❌ No objectKey received in onComplete callback");
                            toast({ 
                              title: "Upload failed", 
                              description: "Failed to get file key. Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                        getViewUrlEndpoint="/api/auth/profile/avatar-url"
                        acceptedTypes="image/*"
                        maxFileSize={5 * 1024 * 1024} // 5MB
                        title="Upload Profile Picture"
                        description="Choose a profile picture to upload. This will be visible to other users."
                        fileTypeLabel="image file"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Image
                      </ObjectUploader>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div>
                <h3 className="text-lg font-medium">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getRoleBadgeColor(user?.role || "")}>
                    {user?.role}
                  </Badge>
                  {user?.role === "ADMIN" && (
                    <Badge variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin Access
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  data-testid="input-name"
                  readOnly={!isEditMode}
                  className={!isEditMode ? "bg-muted cursor-default" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  data-testid="input-phone"
                  readOnly={!isEditMode}
                  className={!isEditMode ? "bg-muted cursor-default" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.role || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Role is assigned by administrator
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredTrack">Preferred Track</Label>
                <Input
                  id="preferredTrack"
                  value={
                    (profileDetailed?.preferredTrack && 
                    typeof profileDetailed.preferredTrack === 'string' && 
                    profileDetailed.preferredTrack.trim() !== "") 
                      ? profileDetailed.preferredTrack 
                      : (isLoadingProfile ? "Loading..." : "Not specified")
                  }
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Track selected in application form
                  {profileError && <span className="text-red-500"> (Error loading)</span>}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Cohort</Label>
                <Input
                  id="domain"
                  value={
                    (profileDetailed?.domain && 
                    typeof profileDetailed.domain === 'string' && 
                    profileDetailed.domain.trim() !== "") 
                      ? profileDetailed.domain 
                      : (isLoadingProfile ? "Loading..." : "Not specified")
                  }
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Cohort selected in application form
                  {profileError && <span className="text-red-500"> (Error loading)</span>}
                </p>
              </div>
            </div>

            {isEditMode && (
              <Button
                onClick={() => {
                  handleSaveProfile();
                  setIsEditMode(false);
                }}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card data-tour="settings-appearance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Select your preferred color theme
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  data-testid="button-theme-light"
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  data-testid="button-theme-dark"
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  data-testid="button-theme-system"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  System
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <Label className="text-base">Color palette</Label>
                <p className="text-sm text-muted-foreground">
                  Applies to buttons, links, charts and the sidebar
                </p>
              </div>
              <div className="flex items-center gap-2">
                {PALETTES.map((option) => (
                  <Button
                    key={option.id}
                    variant={palette === option.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPalette(option.id)}
                    data-testid={`button-palette-${option.id}`}
                  >
                    <span
                      className="h-3 w-3 rounded-full mr-2 border border-black/20"
                      style={{ backgroundColor: option.swatch }}
                      aria-hidden="true"
                    />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Color palette</Label>
                <p className="text-sm text-muted-foreground">
                  Applies to buttons, links, charts and the sidebar
                </p>
              </div>
              <div className="flex items-center gap-2">
                {PALETTES.map((option) => (
                  <Button
                    key={option.id}
                    variant={palette === option.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPalette(option.id)}
                    data-testid={`button-palette-${option.id}`}
                  >
                    <span
                      className="h-3 w-3 rounded-full mr-2 border border-black/10"
                      style={{ backgroundColor: option.swatch }}
                      aria-hidden="true"
                    />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tour Settings Section - for CO-FOUNDER */}
        {user?.role === "COFOUNDER" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Tour Settings
              </CardTitle>
              <CardDescription>
                Manage guided tours and walkthrough preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show Platform Tour Button</Label>
                  <p className="text-sm text-muted-foreground">
                    Show or hide the "Platform Tour" button on all pages
                  </p>
                </div>
                <Switch
                  checked={cofounderPlatformTourEnabled}
                  onCheckedChange={(checked) => {
                    setCofounderPlatformTourEnabled(checked);
                    if (checked) {
                      localStorage.removeItem("sv_cofounder_platform_tour_disabled");
                    } else {
                      localStorage.setItem("sv_cofounder_platform_tour_disabled", "true");
                    }
                    window.dispatchEvent(new Event("cofounder-platform-tour-visibility-changed"));
                  }}
                  data-testid="switch-cofounder-platform-tour"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show Page Guide Button</Label>
                  <p className="text-sm text-muted-foreground">
                    Show or hide the "Page Guide" buttons on all pages
                  </p>
                </div>
                <Switch
                  checked={cofounderPageGuideEnabled}
                  onCheckedChange={(checked) => {
                    setCofounderPageGuideEnabled(checked);
                    if (checked) {
                      localStorage.removeItem(`sv_tour_buttons_disabled_${userId}`);
                    } else {
                      localStorage.setItem(`sv_tour_buttons_disabled_${userId}`, "true");
                    }
                    window.dispatchEvent(new Event("tour-buttons-visibility-changed"));
                  }}
                  data-testid="switch-cofounder-page-guide"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tour Settings Section - only for FOUNDER */}
        {user?.role === "FOUNDER" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Tour Settings
              </CardTitle>
              <CardDescription>
                Manage guided tours and walkthrough preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Replay Sidebar Tour</Label>
                  <p className="text-sm text-muted-foreground">
                    Walk through the sidebar navigation again
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.dispatchEvent(new Event("restart-sidebar-tour"));
                    toast({
                      title: "Sidebar Tour started",
                      description: "Navigate to any page to see the sidebar walkthrough.",
                    });
                  }}
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Replay Tour
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Show Page Guide Buttons</Label>
                  <p className="text-sm text-muted-foreground">
                    Show or hide the "? Tour" buttons on all pages
                  </p>
                </div>
                <Switch
                  checked={tourButtonsEnabled}
                  onCheckedChange={(checked) => {
                    setTourButtonsEnabled(checked);
                    if (checked) {
                      localStorage.removeItem(`sv_tour_buttons_disabled_${userId}`);
                    } else {
                      localStorage.setItem(`sv_tour_buttons_disabled_${userId}`, "true");
                    }
                    window.dispatchEvent(new Event("tour-buttons-visibility-changed"));
                  }}
                  data-testid="switch-tour-buttons"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates and alerts via email
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                data-testid="switch-email-notifications"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get instant notifications in your browser
                </p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
                data-testid="switch-push-notifications"
              />
            </div>
          </CardContent>
        </Card>

        {/* Guide Preferences Section - only for MENTOR */}
        {user?.role === "MENTOR" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Guide Preferences
              </CardTitle>
              <CardDescription>
                Control the visibility of in-app tour and guide features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Platform Tour</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable the sidebar platform tour for all pages
                  </p>
                </div>
                <Switch
                  checked={mentorPlatformTourEnabled}
                  onCheckedChange={(checked) => {
                    setMentorPlatformTourEnabled(checked);
                    if (checked) {
                      localStorage.removeItem(`sv_platform_tour_disabled_${userId}`);
                    } else {
                      localStorage.setItem(`sv_platform_tour_disabled_${userId}`, "true");
                    }
                    window.dispatchEvent(new Event("platform-tour-visibility-changed"));
                  }}
                  data-testid="switch-mentor-platform-tour"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Page Guide</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable the page guide button on supported pages
                  </p>
                </div>
                <Switch
                  checked={mentorPageGuideEnabled}
                  onCheckedChange={(checked) => {
                    setMentorPageGuideEnabled(checked);
                    if (checked) {
                      localStorage.removeItem(`sv_tour_buttons_disabled_${userId}`);
                    } else {
                      localStorage.setItem(`sv_tour_buttons_disabled_${userId}`, "true");
                    }
                    window.dispatchEvent(new Event("tour-buttons-visibility-changed"));
                  }}
                  data-testid="switch-mentor-page-guide"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your account security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Password</p>
                
              </div>
              <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-change-password">
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md !bg-white dark:!bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-gray-900">Change Password</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-600">
                      Enter your current password and choose a new password.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="old-password" className="text-gray-900 dark:text-gray-900">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="old-password"
                          type={showOldPassword ? "text" : "password"}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="pr-10 [&::placeholder]:!text-gray-500"
                          style={{ backgroundColor: "#fff", color: "#111", WebkitTextFillColor: "#111" }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                        >
                          {showOldPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-gray-900 dark:text-gray-900">New Password</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="pr-10 [&::placeholder]:!text-gray-500"
                          style={{ backgroundColor: "#fff", color: "#111", WebkitTextFillColor: "#111" }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-600">
                        Password must be at least 8 characters with one number and one special character
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-gray-900 dark:text-gray-900">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="pr-10 [&::placeholder]:!text-gray-500"
                          style={{ backgroundColor: "#fff", color: "#111", WebkitTextFillColor: "#111" }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowChangePassword(false)}
                      disabled={changePasswordMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Change Password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account ID</span>
                <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Created</span>
                <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
