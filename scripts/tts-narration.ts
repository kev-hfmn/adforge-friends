/**
 * ElevenLabs narration with word timings, for narrated reels.
 *
 *   npx tsx scripts/tts-narration.ts <script.json> <outDir> [voiceId ...]
 *
 * script.json: { "speed"?: 0.7-1.2, "lines": [{ "say": "spoken text", "show"?: "on-screen text" }] }
 * `say` may spell things out for the voice ("A I" for "AI", "twenty four seven" for "24/7"); `show` is what the screen prints.
 * Writes <outDir>/<voiceName>.mp3 and <voiceName>.json (character timings per line), so the reel
 * composition can cut each visual on the line it belongs to.
 * Needs ELEVENLABS_API_KEY in the environment or in .env.local. Never prints the key.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

type Line = { say: string; show?: string };

function apiKey(): string {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  if (existsSync(".env.local")) {
    for (const l of readFileSync(".env.local", "utf8").split("\n")) {
      const m = l.match(/^ELEVENLABS_API_KEY=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("ELEVENLABS_API_KEY is not set");
}

const VOICES: Record<string, string> = {
  brian: "nPczCjzI2devNBz1zQrb",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  george: "JBFqnCBsd6RMkjVDRZzb",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
};

async function main() {
  const [scriptPath, outDir, ...picked] = process.argv.slice(2);
  if (!scriptPath || !outDir) throw new Error("usage: tts-narration.ts <script.json> <outDir> [voice ...]");
  const { lines, speed } = JSON.parse(readFileSync(scriptPath, "utf8")) as { lines: Line[]; speed?: number };
  // A paragraph break between lines gives the voice a natural beat to cut on.
  const text = lines.map((l) => l.say.trim()).join("\n\n");
  mkdirSync(outDir, { recursive: true });
  const key = apiKey();

  for (const name of picked.length ? picked : Object.keys(VOICES)) {
    const id = VOICES[name] ?? name;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, ...(speed ? { speed } : {}) },
      }),
    });
    if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as {
      audio_base64: string;
      alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };
    };
    writeFileSync(join(outDir, `${name}.mp3`), Buffer.from(j.audio_base64, "base64"));

    // Map each script line to its start/end time via character offsets in the joined text.
    const a = j.alignment;
    const timings: {
      start: number;
      end: number;
      say: string;
      show: string;
      words: { text: string; start: number; end: number }[];
    }[] = [];
    let offset = 0;
    for (const l of lines) {
      const s = offset;
      const say = l.say.trim();
      const e = offset + say.length - 1;
      const words: { text: string; start: number; end: number }[] = [];
      for (const m of say.matchAll(/\S+/g)) {
        const ws = s + m.index!;
        const we = ws + m[0].length - 1;
        words.push({
          text: m[0],
          start: a.character_start_times_seconds[ws] ?? 0,
          end: a.character_end_times_seconds[Math.min(we, a.characters.length - 1)] ?? 0,
        });
      }
      timings.push({
        start: a.character_start_times_seconds[s] ?? 0,
        end: a.character_end_times_seconds[Math.min(e, a.characters.length - 1)] ?? 0,
        say,
        show: (l.show ?? l.say).trim(),
        words,
      });
      offset = e + 1 + 2; // skip the "\n\n"
    }
    const duration = a.character_end_times_seconds.at(-1) ?? 0;
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ voice: name, voiceId: id, duration, lines: timings }, null, 2));
    console.log(`${name}: ${duration.toFixed(1)}s`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
