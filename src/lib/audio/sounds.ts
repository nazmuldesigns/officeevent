type SoundKind = "tick" | "verified" | "already" | "invalid_day" | "missing" | "error";

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
  gain = 0.24,
  type: OscillatorType = "sine",
) {
  try {
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(audio.destination);
    osc.start(start);
    osc.stop(start + duration + 0.04);
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
    // Crisp camera scan snap
    tone(audio, t, 2200, 0.04, 0.14, "sine");
    return;
  }

  if (kind === "verified") {
    // Premium VIP Entrance Chime (D5 - F#5 - A5 - D6 sparkling arpeggio)
    // Much louder and crisper for crowded event gates
    tone(audio, t, 587.33, 0.09, 0.22, "sine");
    tone(audio, t + 0.065, 739.99, 0.09, 0.24, "sine");
    tone(audio, t + 0.13, 880.0, 0.14, 0.26, "sine");
    tone(audio, t + 0.19, 1174.66, 0.28, 0.28, "triangle");
    vibrate([35, 25, 45]);
    return;
  }

  if (kind === "already") {
    // Punchy warning double-chime (D5 -> A4)
    tone(audio, t, 587.33, 0.12, 0.24, "triangle");
    tone(audio, t + 0.12, 440.0, 0.22, 0.25, "triangle");
    vibrate([40, 30, 40]);
    return;
  }

  if (kind === "invalid_day") {
    // Urgent restricted pass warning (Eb5 -> Bb4 -> F4)
    tone(audio, t, 622.25, 0.11, 0.24, "sawtooth");
    tone(audio, t + 0.1, 466.16, 0.12, 0.25, "sawtooth");
    tone(audio, t + 0.21, 349.23, 0.24, 0.26, "triangle");
    vibrate([60, 40, 60, 40, 100]);
    return;
  }

  if (kind === "missing") {
    // Not registered alert (D4 -> G3)
    tone(audio, t, 293.66, 0.14, 0.25, "sawtooth");
    tone(audio, t + 0.13, 196.0, 0.24, 0.26, "sawtooth");
    vibrate([80, 40, 80]);
    return;
  }

  // Error buzz
  tone(audio, t, 175, 0.24, 0.26, "square");
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
