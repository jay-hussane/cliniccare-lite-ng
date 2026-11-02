export type VisitStatus = "waiting" | "in_consultation" | "completed";

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  waiting: "Waiting to see doctor",
  in_consultation: "With doctor",
  completed: "Completed",
};

/** Visits that are still open in the doctor queue. */
export const OPEN_STATUSES: VisitStatus[] = ["waiting", "in_consultation"];

export function statusLabel(status: string): string {
  return VISIT_STATUS_LABELS[status as VisitStatus] ?? status;
}
