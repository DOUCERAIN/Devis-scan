import { Badge } from "@/components/ui/Badge";
import { STATUS_META, type RequestStatus } from "@/lib/requests/status";

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
