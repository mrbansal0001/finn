import { PageSkeleton } from "@/components/Skeletons";

// shown at once when this page is opened, while the server prepares it
export default function Loading() {
  return <PageSkeleton label="Opening research…" />;
}
