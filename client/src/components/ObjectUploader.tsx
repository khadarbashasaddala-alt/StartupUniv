import React, { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle2, AlertCircle, FileVideo, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ObjectUploaderProps {
  maxFileSize?: number;
  acceptedTypes?: string;
  onGetUploadParameters: (file: File) => Promise<{
    method: "PUT";
    url: string;
    objectKey?: string; // Optional: if provided, will fetch GET URL after upload
  }>;
  onComplete?: (fileUrl: string, objectKey?: string, fileName?: string, fileSize?: number, contentType?: string) => void; // Receives GET URL, objectKey, original fileName, size (bytes) and content type
  onError?: (error: Error) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  description?: string;
  fileTypeLabel?: string;
  getViewUrlEndpoint?: string; // Optional: endpoint to get GET URL (e.g., "/api/mentors/files/view-url")
}

export function ObjectUploader({
  maxFileSize = 104857600,
  acceptedTypes = "video/*",
  onGetUploadParameters,
  onComplete,
  onError,
  buttonClassName,
  buttonVariant = "default",
  buttonSize = "default",
  children,
  disabled = false,
  title = "Upload File",
  description,
  fileTypeLabel = "file",
  getViewUrlEndpoint,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      setError(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Pass the selected file to get upload parameters (so it can use the actual file type)
      const uploadParams = await onGetUploadParameters(selectedFile);
      const url = uploadParams.url;
      
      console.log("📤 Got upload URL, starting upload...");
      console.log("📤 URL preview:", url.substring(0, 150));
      console.log("📤 File details:", {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
      });
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

            xhr.addEventListener("load", async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Step 1: Upload succeeded ✅
            console.log("✅ Upload to S3 succeeded");
            
            // Step 2: If objectKey is provided, fetch GET pre-signed URL for viewing
            let fileUrl: string | undefined;
            if (uploadParams.objectKey && getViewUrlEndpoint) {
              console.log("📥 Fetching GET URL for objectKey:", uploadParams.objectKey);
              const viewUrlResponse = await apiRequest("POST", getViewUrlEndpoint, {
                objectKey: uploadParams.objectKey,
              });
              fileUrl = viewUrlResponse?.fileUrl || viewUrlResponse?.viewUrl || viewUrlResponse?.url;
              if (fileUrl) {
                console.log("✅ Got GET URL for viewing:", fileUrl.substring(0, 100) + "...");
              } else {
                console.warn("⚠️ No fileUrl in response:", viewUrlResponse);
              }
            } else {
              // Fallback: use base URL without query params
              fileUrl = uploadParams.url?.split("?")[0];
              console.log("⚠️ No objectKey or getViewUrlEndpoint provided, using base URL");
            }
            
            if (!fileUrl) {
              throw new Error("Failed to get file URL after upload");
            }
            
            setSuccess(true);
            setUploading(false);
            onComplete?.(fileUrl, uploadParams.objectKey, selectedFile.name, selectedFile.size, selectedFile.type);
          } catch (error) {
            console.error("❌ Error fetching view URL:", error);
            // Upload succeeded but GET URL fetch failed - this is a problem
            // The PUT URL won't work for viewing, so we should notify the user
            const errorMessage = error instanceof Error ? error.message : "Failed to get file view URL";
            setError(`Upload succeeded but failed to get view URL: ${errorMessage}`);
            setUploading(false);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
            // Don't call onComplete with invalid URL - let user retry
          }
        } else {
          const error = new Error(`Upload failed with status ${xhr.status}`);
          setError(error.message);
          setUploading(false);
          onError?.(error);
        }
      });

      xhr.addEventListener("error", (e) => {
        console.error("❌ XHR Error:", e);
        console.error("❌ XHR Status:", xhr.status);
        console.error("❌ XHR Status Text:", xhr.statusText);
        console.error("❌ Upload URL:", url.substring(0, 100) + "...");
        const error = new Error(`Upload failed - network error (Status: ${xhr.status || 'Unknown'})`);
        setError(error.message);
        setUploading(false);
        onError?.(error);
      });

      xhr.addEventListener("abort", () => {
        const error = new Error("Upload cancelled");
        setError(error.message);
        setUploading(false);
        onError?.(error);
      });

      xhr.addEventListener("timeout", () => {
        const error = new Error("Upload timeout - please try again");
        setError(error.message);
        setUploading(false);
        onError?.(error);
      });

      // Set timeout (5 minutes for large files)
      xhr.timeout = 5 * 60 * 1000;

      console.log("📤 Starting upload to:", url.substring(0, 100) + "...");
      console.log("📤 File type:", selectedFile.type);
      console.log("📤 File size:", selectedFile.size);
      
      xhr.open("PUT", url);
      
      // IMPORTANT: For S3 presigned PUT URLs, we MUST set the Content-Type header
      // to match the ContentType that was used when generating the signed URL.
      // The backend uses selectedFile.type to generate the signed URL, so we use the same here.
      if (selectedFile.type) {
        xhr.setRequestHeader("Content-Type", selectedFile.type);
        console.log("📤 Set Content-Type header:", selectedFile.type);
      }
      
      // Add error logging before sending
      xhr.addEventListener("readystatechange", () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          console.log("📤 Upload completed. Status:", xhr.status);
          if (xhr.status >= 400) {
            console.error("❌ Upload failed with status:", xhr.status);
            console.error("❌ Response:", xhr.responseText?.substring(0, 200));
          }
        }
      });
      
      xhr.send(selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      onError?.(err instanceof Error ? err : new Error("Upload failed"));
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setShowModal(false);
      setSelectedFile(null);
      setProgress(0);
      setError(null);
      setSuccess(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      {React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement, {
          onClick: () => setShowModal(true),
          disabled,
          ["data-testid"]: (children as any)?.props?.["data-testid"] || "button-upload-demo",
        })
      ) : (
        <Button
          onClick={() => setShowModal(true)}
          className={buttonClassName}
          variant={buttonVariant}
          size={buttonSize}
          disabled={disabled}
          data-testid="button-upload-demo"
        >
          {children}
        </Button>
      )}

      <Dialog open={showModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription>
              {description || `Upload your ${fileTypeLabel} (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={acceptedTypes}
              className="hidden"
              data-testid="input-demo-file"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                data-testid="dropzone-demo"
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select a {fileTypeLabel}
                </p>
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium truncate max-w-48">
                      {selectedFile.name}
                    </span>
                  </div>
                  {!uploading && !success && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedFile(null)}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {formatFileSize(selectedFile.size)}
                </p>

                {uploading && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-center text-muted-foreground">
                      Uploading... {progress}%
                    </p>
                  </div>
                )}

                {success && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">Upload complete!</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              {success ? "Close" : "Cancel"}
            </Button>
            {!success && (
              <Button 
                onClick={handleUpload} 
                disabled={!selectedFile || uploading}
                data-testid="button-confirm-upload"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
