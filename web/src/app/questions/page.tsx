import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { QuestionTrail } from "@/components/QuestionTrail";

export const metadata = { title: "Questions you follow · FINN" };

export default function QuestionsPage() {
  return (
    <main>
      <BackLink fallback="/" />
      <h1 className="font-serif text-display">Questions you follow</h1>
      <p className="mt-1 text-body text-ink-2">What you asked, what you were waiting for, and what has been filed since.</p>
      <Suspense fallback={<p className="mt-6 text-caption text-ink-3">Loading…</p>}>
        <QuestionTrail />
      </Suspense>
      <Dock />
    </main>
  );
}
