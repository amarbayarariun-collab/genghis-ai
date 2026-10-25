import { Suspense } from "react";
import { ChatApp } from "@/components/chat/chat-app";

function ChatFallback() {
  return (
    <div className="flex h-dvh items-center justify-center bg-cream">
      <p className="text-lg tracking-tight text-ink">
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
