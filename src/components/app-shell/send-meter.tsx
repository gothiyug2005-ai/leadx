import { Send } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { getSendAllowance } from "@/lib/data/shell";

/** Today's send allowance, so the daily cap is never a surprise. */
export async function SendMeter() {
  const allowance = await getSendAllowance();
  if (!allowance) return null;

  const percent =
    allowance.cap > 0 ? (allowance.used / allowance.cap) * 100 : 0;

  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border p-3 text-xs">
      <div className="flex items-center gap-2 font-medium">
        <Send className="text-muted-foreground size-3.5" aria-hidden />
        Emails today
        <span className="text-muted-foreground ml-auto tabular-nums">
          {allowance.used} / {allowance.cap}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label="Emails sent today"
        className="h-1.5"
      />
      <p className="text-muted-foreground">
        {allowance.remaining > 0
          ? `${allowance.remaining} left before your daily limit.`
          : "Daily limit reached. Sending resumes tomorrow."}
      </p>
    </div>
  );
}
