import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSpeechRecognizer, type SpeechHandle } from "@/lib/speech";

export function useMic(onTranscript: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechHandle | null>(null);
  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => () => { recRef.current?.stop(); }, []);

  const toggle = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = createSpeechRecognizer({
      onResult: onTranscript,
      onError: (err) => { toast.error(`Mic: ${err}`); setListening(false); },
      onEnd: () => setListening(false),
    });
    if (!rec) { toast.error("Speech recognition not supported in this browser"); return; }
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return { listening, supported, toggle };
}

export function MicButton({
  listening,
  supported,
  onClick,
  size = 44,
}: {
  listening: boolean;
  supported: boolean;
  onClick: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      title={supported ? (listening ? "Stop listening" : "Speak") : "Mic not supported"}
      style={{ height: size, width: size }}
      className={`flex shrink-0 items-center justify-center rounded-lg border transition ${
        listening ? "border-primary bg-primary text-primary-foreground animate-pulse" : "hover:bg-secondary"
      } disabled:opacity-40`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <line x1="12" y1="18" x2="12" y2="22" />
      </svg>
    </button>
  );
}
