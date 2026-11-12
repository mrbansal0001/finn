import { PersonSkeleton } from "@/components/Skeletons";

// shown at once when this page is opened, while the server prepares it (13 Nov)
export default function Loading() {
  return <PersonSkeleton />;
}
