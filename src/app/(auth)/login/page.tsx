import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { isDevLoginEnabled } from "@/lib/auth";
import { safeNextPath } from "@/lib/routes";

import { signInWithDevAccount, signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  google_unavailable:
    "Google sign-in is not available right now. Check that the Google provider is switched on in Supabase, then try again.",
  sign_in_failed:
    "We could not complete the sign-in. Please try again; if it keeps happening, the sign-in link may have expired.",
  dev_login_disabled: "Dev login is not enabled in this environment.",
  dev_login_invalid_email: "Enter a valid email address for the dev login.",
  dev_login_failed:
    "Dev login failed. Is the local Supabase stack running with email sign-ups enabled?",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="bg-muted/40 flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-3">
          <Brand />
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-xl">Welcome to LeadX</CardTitle>
            <CardDescription>
              Sign in to find the right people, write messages that sound like
              you, and keep track of every conversation.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginForm({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? "Something went wrong. Please try again.")
    : undefined;
  const devLogin = isDevLoginEnabled();

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="outline" size="lg" className="w-full">
          <GoogleLogo />
          Continue with Google
        </SubmitButton>
      </form>

      <p className="text-muted-foreground text-xs">
        We only use your Google account to sign you in. Connecting Gmail for
        sending is a separate step you choose later.
      </p>

      {devLogin ? (
        <>
          <Separator />
          <form action={signInWithDevAccount} className="flex flex-col gap-3">
            <input type="hidden" name="next" value={next} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dev-email">Dev login (local only)</Label>
              <Input
                id="dev-email"
                name="email"
                type="email"
                required
                defaultValue="dev@leadx.test"
                autoComplete="off"
              />
            </div>
            <SubmitButton variant="secondary" className="w-full">
              Sign in as dev user
            </SubmitButton>
          </form>
        </>
      ) : null}
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.200-4.100 1.200-3.100 0-5.800-2.100-6.700-5H1.300v3.100A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.300 14.300a7.200 7.200 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.800c1.800 0 3.300.6 4.600 1.800l3.400-3.400A12 12 0 0 0 1.300 6.600l4 3.100c.9-2.900 3.600-4.900 6.700-4.900Z"
      />
    </svg>
  );
}
