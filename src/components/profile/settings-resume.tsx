"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ResumeUpload } from "@/components/profile/resume-upload";

/** Re-upload a resume from Settings; the profile form below refreshes with the result. */
export function SettingsResume({
  userId,
  fileName,
}: {
  userId: string;
  fileName: string | null;
}) {
  const router = useRouter();
  return (
    <ResumeUpload
      userId={userId}
      currentFileName={fileName}
      onParsed={() => {
        toast.success("Resume read. Review your profile below.");
        router.refresh();
      }}
    />
  );
}
