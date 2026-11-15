import { Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** Shown wherever AI output is sample data because no Anthropic key is set. */
export function SampleNotice({ children }: { children?: React.ReactNode }) {
  return (
    <Alert>
      <Sparkles aria-hidden />
      <AlertDescription>
        {children ??
          "This is sample output: the AI is not connected yet. Edit it freely, or connect Anthropic to get results based on your real information."}
      </AlertDescription>
    </Alert>
  );
}
