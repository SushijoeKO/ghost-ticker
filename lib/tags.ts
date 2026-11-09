// Ghost Ticker's original spy-themed headline tags.
// Pure module (no imports) so the tragedy rule can be unit-tested with plain Node.

export type TagName =
  | "FLASH" | "PRIORITY"
  | "SUSPICIOUS" | "BURN NOTICE" | "ROGUE AGENT" | "DOUBLE AGENT" | "COVER BLOWN" | "ASSET ACQUIRED"
  | "NEED-TO-KNOW" | "OBVIOUSLY" | "WTF-INT" | "FLORIDA FILE" | "CRITTER-INT" | "GADGET-INT"
  | "PAPER TRAIL" | "EXFIL" | "MOLE HUNT" | "HONEYPOT" | "SAFEHOUSE"
  // sports / entertainment / pop culture desks
  | "PLAYBOOK LEAKED" | "ASSET TRANSFER" | "AMBUSH" | "MISSION DEBRIEF"
  | "PAPARAZZI SIGINT" | "COVER IDENTITY" | "DROP ZONE" | "COUNTERINTEL" | "BOX OFFICE INTEL" | "SPOILER CLEARANCE" | "MEME-INT" | "SIDE QUEST";

export interface Tag { name: TagName; tone: "neutral" | "snark"; hint: string }

// Anything touching death, violence, disaster, abuse or terror is "sensitive":
// it may only ever receive a neutral FLASH / PRIORITY tag.
export const TRAGEDY_RE = new RegExp(
  "\\b(" + [
    "dead", "deadly", "death", "deaths", "die", "dies", "died", "dying", "kill", "kills", "killed", "killing", "killings", "killer",
    "murder\\w*", "homicide\\w*", "manslaughter", "slain", "slay\\w*", "fatal\\w*", "fatalit\\w*", "corpse", "body", "bodies", "remains",
    "shoot\\w*", "shot", "shots", "gun\\w*", "gunfire", "gunm[ae]n", "massacre\\w*", "stab\\w*", "knife", "machete",
    "bomb\\w*", "explosion\\w*", "explod\\w*", "blast\\w*", "terror\\w*", "jihad\\w*", "extremis\\w*", "attack\\w*", "assault\\w*", "hostage\\w*", "kidnap\\w*", "abduct\\w*",
    "war", "wars", "warfare", "airstrike\\w*", "air strike\\w*", "strikes?", "missile\\w*", "drone strike\\w*", "shelling", "invasion", "invade\\w*", "genocide", "atrocit\\w*", "casualt\\w*", "wounded", "injur\\w*", "maimed",
    "earthquake\\w*", "quake\\w*", "tsunami\\w*", "hurricane\\w*", "typhoon\\w*", "cyclone\\w*", "tornado\\w*", "flood\\w*", "wildfire\\w*", "fire", "fires", "blaze", "landslide\\w*", "mudslide\\w*", "avalanche\\w*", "eruption", "volcano\\w*", "famine", "drought",
    "disaster\\w*", "catastroph\\w*", "tragedy", "tragic", "tragedies", "crash\\w*", "collision", "derail\\w*", "collapse\\w*", "sinking", "sank", "capsiz\\w*", "drown\\w*", "missing",
    "rape\\w*", "sexual\\w*", "molest\\w*", "abuse\\w*", "abusing", "assaulted", "groom\\w*", "trafficking", "trafficked", "child porn\\w*", "exploitation", "torture\\w*", "domestic violence", "violence", "violent",
    "suicide\\w*", "overdose\\w*", "fentanyl", "funeral\\w*", "mourn\\w*", "vigil\\w*", "victim\\w*", "grief", "grieving", "memorial", "condolence\\w*",
    "cancer", "terminal", "poison\\w*", "stroke", "strokes", "heart attacks?", "heart failure", "dementia", "alzheimer\\w*", "diseases?", "sick", "dementia", "outbreak", "epidemic", "pandemic", "ebola", "cholera", "hospitali\\w*", "illness\\w*", "sickened", "critical condition", "life support", "coma",
    // sports injuries, celebrity deaths, abuse / misconduct cases
    "passed away", "obituar\\w*", "rip", "r\\.i\\.p", "in memoriam", "laid to rest", "remember(ed|ing)", "tributes?", "legacy of",
    "concussion\\w*", "acl", "mcl", "achilles", "torn", "ruptur\\w*", "fractur\\w*", "broken (leg|arm|ankle|neck|back|foot|wrist|hand|jaw|ribs?)", "surgery", "surgeries", "carted off", "stretchered off", "season-ending", "out for (the )?season", "medical (emergency|episode|scare)", "cardiac", "seizure\\w*",
    "harass\\w*", "misconduct", "allegation\\w*", "accus(er|ers|ed|ation|ations)", "restraining order", "metoo", "grooming", "battery", "stalk(er|ers|ing)",
    "evacuat\\w*", "emergency", "refugee\\w*", "starv\\w*", "hunger", "massacre", "execution\\w*", "executed", "hanged", "lynch\\w*", "hate crime\\w*", "racis\\w*", "antisemit\\w*", "holocaust",
  ].join("|") + ")\\b",
  "i"
);

// Children + criminal allegation (e.g. "man charged with giving kids drugs") is treated as abuse-adjacent.
const CHILD_HARM_RE = /\b(kids?|child(ren)?|toddlers?|infants?|bab(y|ies)|minors?|students?|teens?)\b[^.]{0,60}\b(charged|accused|arrested|indicted|drugg?\w*|gumm\w*|endanger\w*|neglect\w*)\b|\b(charged|accused|arrested|indicted)\b[^.]{0,60}\b(kids?|child(ren)?|toddlers?|infants?|bab(y|ies)|minors?)\b/i;

export function isSensitive(text: string): boolean {
  return TRAGEDY_RE.test(text) || CHILD_HARM_RE.test(text);
}

const RULES: { name: TagName; re: RegExp; cats?: string[]; hint: string }[] = [
  // ---- sports desk ----
  { name: "MISSION DEBRIEF", re: /\b(takeaways|grades?|winners and losers|recap|observations|power rankings?|what we learned|overreactions?)\b/i, cats: ["sports"], hint: "After-action report filed" },
  { name: "PLAYBOOK LEAKED", re: /\b(rumou?rs?|reportedly|sources say|per sources|insider|leak\w*|mock draft|predictions?|picks?|odds|best bets?)\b/i, cats: ["sports"], hint: "Someone talked" },
  { name: "ASSET TRANSFER", re: /\b(trade[sd]?|trading|signs?|signed|signing|transfer\w*|free agen\w*|contract|extension|waive[sd]?|released|acquire[sd]?|deal)\b/i, cats: ["sports"], hint: "Operative changing handlers" },
  { name: "AMBUSH", re: /\b(upset\w*|stun\w*|shock\w*|comeback|rall(y|ies|ied)|surprise|underdog\w*|walk-?off|buzzer-?beater|thriller)\b/i, cats: ["sports"], hint: "Nobody saw it coming" },
  // ---- entertainment / pop-culture desks ----
  { name: "BOX OFFICE INTEL", re: /\b(box office|opening weekend|ratings|viewership|nielsen|streaming (numbers|charts?)|billboard 200|hot 100|no\. ?1|number one|chart\w*|tops|debuts at)\b/i, cats: ["entertainment", "pop-culture"], hint: "The numbers are in" },
  { name: "SPOILER CLEARANCE", re: /\b(spoilers?|ending explained|finale|post-credits?|season \d+|episode \d+|recap)\b/i, cats: ["entertainment", "pop-culture"], hint: "Need-to-know basis only" },
  { name: "DROP ZONE", re: /\b(trailer|teaser|first look|drops?|dropped|surprise[- ]releases?|new (album|single|song|ep|music video|tour)|announces? (tour|album)|premiere\w*|release date)\b/i, cats: ["entertainment", "pop-culture"], hint: "Package delivered" },
  { name: "COVER IDENTITY", re: /\b(cast as|casting|joins (the )?cast|to play|to star|starring role|biopic|reboot|remake|revival|transformation|unrecognizable|rebrand\w*|new look)\b/i, cats: ["entertainment", "pop-culture"], hint: "New legend issued" },
  { name: "COUNTERINTEL", re: /\b(feud\w*|slams?|claps? back|fires back|throws shade|shades?|calls out|responds? to|beef|diss\w*|snubs?|snubbed)\b/i, cats: ["entertainment", "pop-culture"], hint: "Return fire detected" },
  { name: "PAPARAZZI SIGINT", re: /\b(spotted|seen (with|at|together)|pda|packs on|cozy|cozies|date night|steps out|photographed|dating|romance|engaged|engagement|split|splits|breakup|break up|couple)\b/i, cats: ["entertainment", "pop-culture"], hint: "Long-lens surveillance" },
  { name: "SIDE QUEST", re: /\b(games?|gaming|gamers?|nintendo|playstation|ps5|xbox|switch 2|steam|dlc|gta|zelda|pok[eé]mon|minecraft|fortnite|esports)\b/i, cats: ["pop-culture"], hint: "Optional objective unlocked" },
  { name: "MEME-INT", re: /\b(viral|memes?|tiktok|trend(ing|s)?|internet (is|can't|reacts)|fans (are|react|slam|think)|reddit|social media|x users|goes viral)\b/i, cats: ["entertainment", "pop-culture"], hint: "Chatter on open channels" },
  { name: "FLORIDA FILE", re: /\bflorida\b|\bflorida man\b|\bflorida woman\b/i, hint: "Sunshine State dossier" },
  { name: "BURN NOTICE", re: /\b(fired|sacked|ousted|axed|resign(s|ed|ation)?|steps? down|quits?|booted|dismissed|let go|forced out)\b/i, hint: "Someone just lost their clearance" },
  { name: "DOUBLE AGENT", re: /\b(flip[- ]?flops?|u-turn|reverses? (course|stance|position)|switch(es|ed)? (parties|sides)|defects?|defected|backtracks?|walks? back)\b/i, hint: "Allegiances may vary" },
  { name: "COVER BLOWN", re: /\b(leak(s|ed)?|exposed|revealed|unmasked|caught on (camera|video|tape)|scandal|busted|outed|hacked|hack)\b/i, hint: "So much for secrecy" },
  { name: "ASSET ACQUIRED", re: /\b(acquires?|acquired|acquisition|buys?|bought|merger|takeover|snaps? up|deal to (buy|acquire))\b/i, hint: "Money changed hands" },
  { name: "PAPER TRAIL", re: /\b(sues?|sued|lawsuit|subpoena\w*|indict\w*|court filing|filings?|documents? show|records? show|audit|deposition)\b/i, hint: "It's all in the file" },
  { name: "MOLE HUNT", re: /\b(probe|investigat\w*|inquiry|watchdog|inspector general|whistleblower)\b/i, hint: "Someone is asking questions" },
  { name: "EXFIL", re: /\b(escape[sd]?|escaping|flees?|fled|on the run|breaks? out|jailbreak)\b/i, hint: "Target has left the building" },
  { name: "NEED-TO-KNOW", re: /\b(what (to|you need to) know|explained|explainer|here'?s (what|why|how)|everything (to|you need)|cheat sheet|takeaways)\b/i, hint: "Briefing packet attached" },
  { name: "OBVIOUSLY", re: /\b(study (finds|says|shows|suggests)|survey (finds|says|shows)|scientists (say|find|warn)|experts (say|warn)|researchers (say|find)|poll (finds|shows))\b/i, hint: "Analysts confirm water is wet" },
  { name: "HONEYPOT", re: /\b(scam\w*|phishing|con artist|fraudsters?|too good to be true|catfish\w*|ponzi)\b/i, hint: "Looks sweet. Isn't." },
  { name: "SAFEHOUSE", re: /\b(mansion|bunker|hideout|hide-?out|secret (room|tunnel|door|passage)|panic room|tiny home)\b/i, hint: "Location undisclosed" },
  { name: "ROGUE AGENT", re: /\b(arrested|charged|cited|busted|nabbed|police say|deputies|naked|drunk|stole|steals|stolen|joyride|rampage)\b/i, cats: ["weird"], hint: "Acting outside orders" },
  { name: "CRITTER-INT", re: /\b(dog|dogs|cat|cats|bear|bears|raccoon|alligator|gator|goat|goats|cow|cows|squirrel|monkey|snake|python|moose|deer|parrot|pig|llama|kangaroo|penguin|octopus|shark|seal|otter|owl|chicken|duck|geese|goose|hamster|crocodile|lizard|iguana|turtle|tortoise|whale|dolphin|animal|animals)\b/i, cats: ["weird"], hint: "Non-human operative" },
  { name: "GADGET-INT", re: /\b(robot\w*|ai|a\.i\.|chatbot|drone|gadget|app|smartphone|iphone|android|algorithm|deepfake|vr|headset)\b/i, cats: ["weird", "tech"], hint: "Q branch would be proud" },
  { name: "SUSPICIOUS", re: /\b(myster\w*|unexplained|ufo\w*|uap|alien\w*|conspirac\w*|suspicious|strange|bizarre|baffl\w*|odd|weird|eerie|cryptid|bigfoot|ghost\w*|haunted)\b/i, hint: "Something doesn't add up" },
];

export interface TagInput { title: string; snippet?: string; category: string; categories?: string[]; breaking: boolean }

export function tagFor(i: TagInput): Tag | null {
  const text = `${i.title} ${i.snippet ?? ""}`;
  const cats = i.categories ?? [i.category];
  // Satire is already a joke. No snark tag, and no FLASH / PRIORITY either.
  if (i.category === "satire" || cats.includes("satire")) return null;
  if (isSensitive(text)) {
    if (i.breaking) return { name: "FLASH", tone: "neutral", hint: "Priority traffic" };
    const hard = cats.some((c) => c === "top" || c === "politics" || c === "us" || c === "world");
    return hard ? { name: "PRIORITY", tone: "neutral", hint: "Handle with care" } : null;
  }
  if (i.breaking) return { name: "FLASH", tone: "neutral", hint: "Priority traffic" };
  for (const r of RULES) {
    if (r.cats && !r.cats.some((c) => cats.includes(c))) continue;
    if (r.re.test(i.title)) return { name: r.name, tone: "snark", hint: r.hint };
  }
  if (cats.includes("weird")) return { name: "WTF-INT", tone: "snark", hint: "Intercepted from the fringe" };
  return null;
}

export const SNARK_TAGS: TagName[] = ["SUSPICIOUS", "BURN NOTICE", "ROGUE AGENT", "DOUBLE AGENT", "COVER BLOWN", "ASSET ACQUIRED", "NEED-TO-KNOW", "OBVIOUSLY", "WTF-INT", "FLORIDA FILE", "CRITTER-INT", "GADGET-INT", "PAPER TRAIL", "EXFIL", "MOLE HUNT", "HONEYPOT", "SAFEHOUSE",
  "PLAYBOOK LEAKED", "ASSET TRANSFER", "AMBUSH", "MISSION DEBRIEF", "PAPARAZZI SIGINT", "COVER IDENTITY", "DROP ZONE", "COUNTERINTEL", "BOX OFFICE INTEL", "SPOILER CLEARANCE", "MEME-INT", "SIDE QUEST"];
