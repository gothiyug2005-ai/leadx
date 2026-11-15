import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A headline number. No chart: one value reads best as a number. */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {detail ? (
        <span className="text-muted-foreground text-xs">{detail}</span>
      ) : null}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  table?: ReactNode;
}) {
  return (
    <section
      className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
      aria-label={title}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
      {table ? (
        <details className="text-sm">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            Show as a table
          </summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      ) : null}
    </section>
  );
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps)
    if (step * magnitude >= value) return step * magnitude;
  return 10 * magnitude;
}

interface WeeklyRow {
  label: string;
  sends: number;
  replies: number;
}

/**
 * Two series side by side per week: thin bars, a 2px gap between the pair,
 * rounded data ends on the baseline, a recessive grid, a legend, and a native
 * hover tooltip on every bar (plus a table view below).
 */
export function WeeklyBars({ rows }: { rows: WeeklyRow[] }) {
  const max = niceMax(
    Math.max(1, ...rows.flatMap((row) => [row.sends, row.replies])),
  );
  const ticks = [0, max / 2, max];
  const height = 160;

  return (
    <div className="flex flex-col gap-3">
      <ul
        className="text-muted-foreground flex gap-4 text-xs"
        aria-label="Legend"
      >
        <li className="flex items-center gap-1.5">
          <span className="bg-chart-1 size-2.5 rounded-sm" aria-hidden /> Emails
          sent
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-chart-2 size-2.5 rounded-sm" aria-hidden />{" "}
          Replies
        </li>
      </ul>
      <div className="flex gap-2">
        <div
          className="text-muted-foreground relative w-6 shrink-0 text-right text-[10px] tabular-nums"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(1 - tick / max) * 100}%` }}
            >
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="relative" style={{ height }}>
            {ticks.map((tick) => (
              <div
                key={tick}
                className="border-border/70 absolute inset-x-0 border-t"
                style={{ top: `${(1 - tick / max) * 100}%` }}
                aria-hidden
              />
            ))}
            <div
              className="absolute inset-0 grid items-end"
              style={{
                gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
              }}
            >
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="group hover:bg-accent/40 flex h-full items-end justify-center gap-0.5 px-1"
                >
                  {(["sends", "replies"] as const).map((series) => {
                    const value = row[series];
                    return (
                      <div
                        key={series}
                        className={cn(
                          "w-full max-w-4 rounded-t-[4px]",
                          series === "sends" ? "bg-chart-1" : "bg-chart-2",
                          value === 0 && "h-px opacity-40",
                        )}
                        style={
                          value
                            ? { height: `${(value / max) * 100}%` }
                            : undefined
                        }
                        title={`Week of ${row.label}: ${value} ${series === "sends" ? "emails sent" : value === 1 ? "reply" : "replies"}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div
            className="text-muted-foreground grid text-center text-[10px]"
            style={{
              gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((row, index) => (
              <span
                key={row.label}
                className={cn(index % 2 === 1 && "max-sm:invisible")}
              >
                {row.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface RankedRow {
  label: string;
  /** 0-1, sets the bar length. */
  share: number;
  value: string;
  detail?: string;
}

/** Ranked horizontal bars, one series, direct labels; for funnels and breakdowns. */
export function RankedBars({
  rows,
  empty,
}: {
  rows: RankedRow[];
  empty: string;
}) {
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex flex-col gap-1"
          title={`${row.label}: ${row.value}${row.detail ? ` (${row.detail})` : ""}`}
        >
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {row.value}
              {row.detail ? (
                <span className="text-muted-foreground ml-1.5 text-xs">
                  {row.detail}
                </span>
              ) : null}
            </span>
          </div>
          <div className="bg-muted h-2 rounded-full">
            <div
              className="bg-chart-1 h-2 rounded-full"
              style={{
                width: `${Math.max(row.share * 100, row.share > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
