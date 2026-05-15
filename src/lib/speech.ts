/** Web Speech API wrapper. Returns null if browser doesn't support it. */
export type SpeechHandle = {
  start: () => void;
  stop: () => void;
};

export function createSpeechRecognizer(opts: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}): SpeechHandle | null {
  if (typeof window === "undefined") return null;
  const SR =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || "en-US";
  rec.onresult = (event: any) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) opts.onResult(final, true);
    else if (interim) opts.onResult(interim, false);
  };
  rec.onerror = (e: any) => opts.onError?.(e.error || "speech error");
  rec.onend = () => opts.onEnd?.();
  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}
