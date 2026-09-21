"use client";

import { useState, useTransition, useEffect } from "react";
import { Award, Upload, FileCheck, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  uploadCertificationAction,
  listCertificationsAction,
} from "@/app/actions/certifications";
import type { CertificationView } from "@/lib/certifications/vault";

export function CertificationVaultCard() {
  const [certs, setCerts] = useState<CertificationView[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCerts() {
      try {
        const data = await listCertificationsAction();
        setCerts(data);
      } catch (err) {
        console.error("Failed to load certifications:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCerts();
  }, []);

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        await uploadCertificationAction(formData);
        setStatusMessage("Certification saved to local vault and added to master resume.");
        form.reset();
        setShowUploadForm(false);
        const updated = await listCertificationsAction();
        setCerts(updated);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to upload certification document.",
        );
      }
    });
  }

  return (
    <Card className="mt-6 border-border/80 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Award className="h-4 w-4 text-accent" />
            Certification and credential vault
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Store proof documents locally. These are compiled into your master resume when tailoring.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="text-xs"
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {showUploadForm ? "Cancel" : "Add certification"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {statusMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <FileCheck className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {showUploadForm && (
          <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-border/70 bg-background/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Certification title *</label>
                <Input
                  name="title"
                  placeholder="AWS Solutions Architect, PMP, CKA"
                  required
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Issuing organization</label>
                <Input
                  name="issuer"
                  placeholder="Amazon Web Services, Scrum.org"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Credential URL or verification link</label>
                <Input
                  name="credentialUrl"
                  placeholder="https://..."
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Issue date</label>
                <Input
                  name="issueDate"
                  type="date"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Proof file (PDF or image) *</label>
              <input
                type="file"
                name="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/80"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={isPending} className="text-xs">
                {isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save credential"
                )}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading vault...</div>
        ) : certs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
            No certifications uploaded yet. Upload certificates or diplomas to verify your background.
          </div>
        ) : (
          <div className="space-y-2">
            {certs.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-card/40 p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{cert.title}</span>
                    {cert.issuer && <Badge variant="muted">{cert.issuer}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Stored locally in vault
                    {cert.credentialUrl ? ` · Link: ${cert.credentialUrl}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
