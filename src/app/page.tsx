import { Suspense } from "react";
import { ChatApp } from "@/components/chat/chat-app";

function ChatFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-white dark:bg-zinc-950">
      <p className="text-lg tracking-tight text-ink dark:text-zinc-100">
        <span className="font-semibold">GENGHIS</span>{" "}
        <span className="font-[family-name:var(--font-heading)] text-gold">
          AI
        </span>
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatApp />
    </Suspense>
  );
}
