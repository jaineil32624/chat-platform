import { personaFor, type Persona } from "./personas";
import { pick } from "../utils";

// Lightweight intent-based reply engine. Each bot reply is shaped by the
// persona's voice (casing, slang, emoji) so conversations feel human.

interface Intent {
  name: string;
  test: RegExp;
  replies: (ctx: ReplyContext) => string[];
}

export interface ReplyContext {
  text: string;
  authorName: string;
  channelName?: string;
  persona: Persona;
  botName: string;
}

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I told my wifi we needed to talk. Now it won't connect with me.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "I'm reading a book on anti-gravity. It's impossible to put down.",
  "Why don't skeletons fight each other? They don't have the guts.",
];

const INTENTS: Intent[] = [
  {
    name: "greeting",
    test: /\b(hi|hey|hello|yo|sup|hiya|howdy|good (morning|evening|afternoon))\b/i,
    replies: (c) => [`hey ${c.authorName.split(" ")[0]}!`, `yo what's up`, `hiii`, `hey hey! how's it going?`, `oh hey, welcome!`],
  },
  {
    name: "howareyou",
    test: /\b(how are (you|u)|how's it going|hows it going|how r u|wyd|what are you (up to|doing))\b/i,
    replies: (c) => [
      `pretty good! ${pick(c.persona.openers).split(/[.!?]/)[0].toLowerCase()}`,
      "doing alright, kinda tired tho. you?",
      `not bad! just ${pick(["chilling", "procrastinating", "grabbing food", "catching up on stuff", "listening to music"])}`,
      "honestly great, today's been a good day",
    ],
  },
  {
    name: "thanks",
    test: /\b(thanks|thank you|thx|ty|appreciate)\b/i,
    replies: () => ["anytime!", "of course 💜", "no problem!", "np!", "happy to help"],
  },
  {
    name: "gaming",
    test: /\b(game|gaming|play|ranked|queue|minecraft|fortnite|valorant|league|xbox|playstation|switch|steam)\b/i,
    replies: (c) => c.persona.key === "gamer"
      ? ["omg yes i'm down to queue", "what rank are you rn?", "bet, send an invite", "that game is so good fr", "i've got like 400 hours in that lol"]
      : ["i'm not much of a gamer but that sounds fun", "my friends keep telling me to try that", "is it hard to get into?", "ooh what game?"],
  },
  {
    name: "music",
    test: /\b(music|song|album|playlist|concert|spotify|band|artist|listening)\b/i,
    replies: () => ["ooh drop the link!", "what genre?", "adding that to my playlist rn", "have you heard the new one from them? it's so good", "music taste approved ✅"],
  },
  {
    name: "study",
    test: /\b(homework|exam|test|study|class|essay|assignment|quiz|finals|school|teacher|grade)\b/i,
    replies: (c) => c.persona.key === "student"
      ? ["omg same, want to study together in #study-hall?", "which class? maybe I can help", "you got this!! take breaks tho", "pomodoro technique saved my life fr"]
      : ["good luck!! you'll crush it", "ugh school stress is real", "what subject?", "remember to sleep lol"],
  },
  {
    name: "code",
    test: /\b(code|coding|bug|javascript|typescript|python|react|deploy|github|api|program|debug|css|html)\b/i,
    replies: (c) => c.persona.key === "dev"
      ? ["have you tried console.log-ing everything? 😅", "ooh what stack are you using?", "push it to github I'll take a look", "classic off-by-one energy", "ship it 🚀"]
      : ["that's so cool you can code", "I wish I understood code lol", "tech people are wizards", "is that the thing with the brackets"],
  },
  {
    name: "food",
    test: /\b(food|eat|hungry|pizza|lunch|dinner|breakfast|snack|cook|recipe|coffee|tea)\b/i,
    replies: () => ["now I'm hungry 😭", "ooh what are you having?", "pizza is always the answer", "send the recipe!!", "coffee is a personality trait at this point"],
  },
  {
    name: "joke",
    test: /\b(joke|funny|lol|lmao|haha|😂|💀)\b/i,
    replies: () => ["LMAOO", "i'm crying 😭", "ok that was actually funny", `here's one: ${pick(JOKES)}`, "💀💀💀"],
  },
  {
    name: "compliment",
    test: /\b(cool|awesome|amazing|nice|great|love (it|this)|beautiful|wow|sick|fire)\b/i,
    replies: () => ["right?!", "fr fr", "thank you!! 🥹", "100% agree", "glad you think so!"],
  },
  {
    name: "sad",
    test: /\b(sad|tired|stressed|bad day|ugh|exhausted|lonely|anxious|upset)\b/i,
    replies: (c) => [`aw ${c.authorName.split(" ")[0]} 🫂 want to talk about it?`, "sending good vibes your way", "that's rough, hope it gets better", "take care of yourself ok? 💜"],
  },
  {
    name: "question",
    test: /\?\s*$/,
    replies: () => ["hmm good question", "honestly not sure, what do you think?", "I think so? 🤔", "depends tbh", "yes absolutely", "probably not lol", "ooh let me think about that"],
  },
  {
    name: "bye",
    test: /\b(bye|gn|good ?night|cya|see (you|ya)|later|gtg|ttyl)\b/i,
    replies: () => ["night!! 🌙", "cya!", "bye bye 👋", "talk later!", "sleep well"],
  },
];

const FALLBACKS = [
  "that's fair", "true true", "wait really?", "interesting 👀", "valid", "ok but same", "haha yeah",
  "omg", "no way", "honestly yeah", "i feel that", "big mood", "hmm 🤔", "love that", "say less",
];

export function detectIntent(text: string): string | undefined {
  return INTENTS.find((i) => i.test.test(text))?.name;
}

/** Apply a persona's voice to a raw reply. */
export function voice(text: string, persona: Persona, rnd = Math.random): string {
  let out = text;
  if (persona.lowercase) out = out.toLowerCase();
  if (rnd() < 0.25 && persona.slang.length) out = rnd() < 0.5 ? `${pick(persona.slang)} ${out}` : `${out} ${pick(persona.slang)}`;
  if (rnd() < persona.emojiRate && !/\p{Extended_Pictographic}/u.test(out)) out = `${out} ${pick(persona.emojis)}`;
  return out;
}

export function generateReply(ctx: Omit<ReplyContext, "persona"> & { personaKey?: string }): string {
  const persona = personaFor(ctx.personaKey);
  const full = { ...ctx, persona };
  const matched = INTENTS.filter((i) => i.test.test(ctx.text));
  const pool = matched.length ? matched[0].replies(full) : FALLBACKS;
  return voice(pick(pool), persona);
}

export function ambientLine(personaKey?: string): string {
  const persona = personaFor(personaKey);
  return voice(pick(persona.openers), persona, () => 1); // openers are already voiced
}

export function followUpLine(previous: string, personaKey?: string): string {
  return generateReply({ text: previous, authorName: "friend", botName: "", personaKey });
}

export function reactionFor(text: string): string {
  const intent = detectIntent(text);
  const map: Record<string, string[]> = {
    joke: ["😂", "💀", "🤣"],
    compliment: ["🔥", "❤️", "💯"],
    sad: ["🫂", "❤️", "🥺"],
    gaming: ["🎮", "🔥"],
    music: ["🎧", "🎶"],
    food: ["😋", "🍕"],
    code: ["💻", "🚀", "🐛"],
    greeting: ["👋", "💜"],
    study: ["📚", "💪"],
  };
  return pick(map[intent ?? ""] ?? ["👍", "❤️", "😂", "👀", "🔥"]);
}

export { JOKES };
