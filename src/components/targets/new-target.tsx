"use client";

import { Building2, FileText, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SampleNotice } from "@/components/profile/sample-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createTarget,
  readJobPosting,
  type PostingReadResult,
} from "@/lib/actions/targets";
import type { TargetFormInput } from "@/lib/validation/target";

import { PersonTargetForm } from "./person-target-form";
import { TargetForm } from "./target-form";

function useCreateTarget() {
  const router = useRouter();
  return async (values: TargetFormInput) => {
    const result = await createTarget(values);
    if (!result.ok) return { ok: false, error: result.error };
    if (result.data.existed) {
      toast.info("You already have this target, so we opened it.");
    } else {
      toast.success("Target created");
    }
    router.push(`/targets/${result.data.id}`);
    return { ok: true };
  };
}

function JobPostingTab() {
  const create = useCreateTarget();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState<PostingReadResult | null>(null);

  async function read() {
    setError(null);
    setReading(true);
    const result = await readJobPosting({ url, text });
    setReading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPosting(result.data);
  }

  if (posting) {
    const extraction = posting.extraction;
    return (
      <div className="flex flex-col gap-5">
        {posting.isSample ? (
          <SampleNotice>
            The AI is not connected yet, so these details were picked out with
            simple rules. Check and fill in anything missing.
          </SampleNotice>
        ) : (
          <p className="text-muted-foreground text-sm">
            Here is what we found. Fix anything that is off, then create the
            target.
          </p>
        )}
        <TargetForm
          kind="job_posting"
          jobText={posting.text}
          submitLabel="Create target"
          initial={{
            company_name: extraction.company_name ?? "",
            company_domain: extraction.company_domain,
            role_title: extraction.role_title,
            team: extraction.team,
            seniority: extraction.seniority,
            location: extraction.location,
            must_have_skills: extraction.must_have_skills,
            nice_to_have_skills: extraction.nice_to_have_skills,
            job_url: posting.url,
            job_summary: extraction.summary,
          }}
          onSubmit={create}
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground self-start"
          onClick={() => setPosting(null)}
        >
          Use a different posting
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="job-url">Job link</Label>
        <Input
          id="job-url"
          type="url"
          inputMode="url"
          placeholder="https://careers.acme.com/jobs/frontend-engineer"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or paste the description
        <span className="bg-border h-px flex-1" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="job-text">Job description</Label>
        <Textarea
          id="job-text"
          rows={8}
          maxLength={30000}
          placeholder="Paste the full job posting here. Works for any site, including ones that block links."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          onClick={() => void read()}
          disabled={reading || (!url.trim() && text.trim().length < 80)}
        >
          {reading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {reading ? "Reading the posting…" : "Read posting"}
        </Button>
      </div>
    </div>
  );
}

export function NewTarget() {
  const create = useCreateTarget();
  return (
    <Tabs defaultValue="job" className="gap-6">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="job">
          <FileText aria-hidden /> Job posting
        </TabsTrigger>
        <TabsTrigger value="company">
          <Building2 aria-hidden /> Company
        </TabsTrigger>
        <TabsTrigger value="person">
          <UserRound aria-hidden /> Person
        </TabsTrigger>
      </TabsList>
      <TabsContent value="job">
        <JobPostingTab />
      </TabsContent>
      <TabsContent value="company" className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          No posting? Name a company you want to work at, and optionally the
          role or team.
        </p>
        <TargetForm
          kind="company"
          showJobFields={false}
          submitLabel="Create target"
          onSubmit={create}
        />
      </TabsContent>
      <TabsContent value="person" className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Already know who you want to reach? Add them and LeadX will help you
          write to them.
        </p>
        <PersonTargetForm />
      </TabsContent>
    </Tabs>
  );
}
