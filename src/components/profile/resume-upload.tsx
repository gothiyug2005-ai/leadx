"use client";

import { FileText, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { parseResume } from "@/lib/actions/profile";
import type { ParsedResume } from "@/lib/ai/schemas/resume";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { RESUME_MAX_BYTES } from "@/lib/validation/profile";

type Status = "idle" | "uploading" | "reading";

interface ResumeUploadProps {
  userId: string;
  currentFileName: string | null;
  onParsed: (result: { resume: ParsedResume; isSample: boolean }) => void;
}

export function ResumeUpload({
  userId,
  currentFileName,
  onParsed,
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = status !== "idle";

  async function handleFile(file: File) {
    setError(null);
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      setError("The resume must be 5 MB or smaller.");
      return;
    }

    setStatus("uploading");
    const path = `${userId}/resume-${Date.now()}.pdf`;
    const { error: uploadError } = await createClient()
      .storage.from("resumes")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      setStatus("idle");
      setError("The upload failed. Check your connection and try again.");
      return;
    }

    setStatus("reading");
    const result = await parseResume({ path, fileName: file.name });
    setStatus("idle");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onParsed(result.data);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !busy) void handleFile(file);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-primary bg-accent/60" : "border-border",
        )}
      >
        <div className="bg-accent flex size-11 items-center justify-center rounded-full">
          {busy ? (
            <Loader2
              className="text-accent-foreground size-5 animate-spin"
              aria-hidden
            />
          ) : (
            <Upload className="text-accent-foreground size-5" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="font-medium">
            {status === "uploading"
              ? "Uploading your resume…"
              : status === "reading"
                ? "Reading your resume… this takes a few seconds"
                : "Drop your resume here"}
          </p>
          <p className="text-muted-foreground text-sm">
            PDF, up to 5 MB. Only you can see it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Choose a PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Resume PDF"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>
      {currentFileName && !busy ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <FileText className="size-4" aria-hidden />
          Current resume: {currentFileName}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
