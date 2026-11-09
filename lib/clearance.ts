// Clearance levels: how widely a story is being reported (number of outlets in its cluster), not whether it is true.
export interface Level { lvl: 1 | 2 | 3 | 4; label: string; min: number; range: string; meaning: string; blurb: string }

export const LEVELS: Level[] = [
  { lvl: 1, label: "CONFIDENTIAL", min: 1, range: "1 outlet", meaning: "1 outlet reporting",
    blurb: "A single intercept. One outlet has the story so far. It may be an exclusive, a niche beat, or just early." },
  { lvl: 2, label: "SECRET", min: 2, range: "2–3 outlets", meaning: "2–3 outlets reporting",
    blurb: "Corroborated chatter. A second or third outlet has picked it up, so the story is starting to travel." },
  { lvl: 3, label: "TOP SECRET", min: 4, range: "4–6 outlets", meaning: "4–6 outlets reporting",
    blurb: "Widely intercepted. Several newsrooms are working the same story at once." },
  { lvl: 4, label: "COSMIC", min: 7, range: "7+ outlets", meaning: "7+ outlets reporting",
    blurb: "Every station is on it. The rare, biggest stories of the day, carried by seven or more of the outlets we watch." },
];

export function clearance(outlets: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (outlets >= LEVELS[i].min) return LEVELS[i];
  return LEVELS[0];
}

export const tipText = (l: Level) => `L${l.lvl} · ${l.label}: ${l.meaning}`;
