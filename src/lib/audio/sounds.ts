type SoundKind = "tick" | "verified" | "already" | "missing" | "error";

let ctx: AudioContext | null = null;
let unlocked = false;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

export async function unlockAudio(): Promise<void> {
  const audio = context();
  if (!audio) return;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      /* ignore */
    }
  }
  unlocked = audio.state === "running";
}

function tone(
  audio: AudioContext,
  start: number,
  freq: number,
  duration: number,
  gain = 0.08,
  type: OscillatorType = "sine",
) {
  try {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {
    /* ignore audio synthesis error */
  }
}

export function playSound(kind: SoundKind, enabled = true): void {
  if (!enabled) return;
  const audio = context();
  if (!audio) return;

  if (audio.state === "suspended") {
    void audio.resume().then(() => {
      unlocked = true;
      executeTone(audio, kind);
    }).catch(() => {});
    return;
  }

  executeTone(audio, kind);
}

function executeTone(audio: AudioContext, kind: SoundKind) {
  const t = audio.currentTime + 0.005;

  if (kind === "tick") {
    tone(audio, t, 1950, 0.035, 0.06, "sine");
    return;
  }

  if (kind === "verified") {
    // Beautiful crisp ascending major chord (C5, E5, G5, C6)
    tone(audio, t, 523.25, 0.08, 0.08, "sine");
    tone(audio, t + 0.06, 659.25, 0.08, 0.08, "sine");
    tone(audio, t + 0.12, 783.99, 0.12, 0.09, "sine");
    tone(audio, t + 0.18, 1046.5, 0.22, 0.1, "triangle");
    vibrate([30, 20, 40]);
    return;
  }

  if (kind === "already") {
    // Amber warning two-tone
    tone(audio, t, 440, 0.11, 0.08, "triangle");
    tone(audio, t + 0.11, 349.23, 0.18, 0.08, "triangle");
    vibrate([30, 40, 30]);
    return;
  }

  if (kind === "missing") {
    // Not registered alert
    tone(audio, t, 240, 0.14, 0.09, "sawtooth");
    tone(audio, t + 0.12, 180, 0.22, 0.09, "sawtooth");
    vibrate([80, 40, 80]);
    return;
  }

  // Error buzz
  tone(audio, t, 160, 0.22, 0.1, "square");
  vibrate([100]);
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}
