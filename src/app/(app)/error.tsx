"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      size="page"
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page hit an unexpected problem. Your data is safe. Try again, and if it keeps happening, refresh the page."
      action={
        <Button onClick={() => retry()} variant="outline">
          <RotateCcw aria-hidden />
          Try again
        </Button>
      }
    />
  );
}
