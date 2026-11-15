import { CircleX, History, MailCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RULES, type MessageType } from "@/lib/writer/rules";

interface SentMessage {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  sent_at: string | null;
  gmail_message_id: string | null;
  status: string;
  error: string | null;
}

export function HistoryCard({ messages }: { messages: SentMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" aria-hidden /> Sent
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3 text-sm">
          {messages.map((message) => {
            const simulated = message.gmail_message_id?.startsWith("mock-");
            return (
              <li
                key={message.id}
                className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {message.status === "sent" ? (
                    <MailCheck
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <CircleX className="text-destructive size-4" aria-hidden />
                  )}
                  <span className="font-medium">
                    {message.subject ??
                      RULES[message.type as MessageType]?.label}
                  </span>
                  {simulated ? (
                    <Badge variant="outline">Simulated</Badge>
                  ) : null}
                  {message.status === "failed" ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {message.sent_at
                      ? new Date(message.sent_at).toLocaleString("en", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
                {message.error ? (
                  <p className="text-destructive text-xs">{message.error}</p>
                ) : null}
                <p className="text-muted-foreground line-clamp-2 whitespace-pre-line">
                  {message.body}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
