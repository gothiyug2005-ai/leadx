import Link from "next/link";
import { ArrowRight, MailCheck, PenLine, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const steps = [
  {
    icon: Users,
    title: "Find the right people",
    description:
      "Turn a job posting or company into a short, ranked list of the people most likely to help.",
  },
  {
    icon: PenLine,
    title: "Write something personal",
    description:
      "Get message drafts grounded in your story, their work, and what you genuinely share.",
  },
  {
    icon: MailCheck,
    title: "Send and follow up",
    description:
      "Send from your own Gmail, with gentle follow-ups and a clear view of who replied.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-12 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-5">
        <p className="text-primary text-sm font-medium">LeadX</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Reach the person behind the job posting.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          LeadX is an outreach copilot for job seekers. Tell it the role you
          want; it helps you find who to contact, what to say, and when to
          follow up.
        </p>
        <div>
          <Button asChild size="lg">
            <Link href="/today">
              Open the app <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-primary mb-2 size-5" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
