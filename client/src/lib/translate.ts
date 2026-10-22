import Anthropic from "@anthropic-ai/sdk";

// Message translation. With a Claude key it's a real translation; offline it
// uses a small phrase dictionary so the feature still demonstrates end-to-end.

export const LANGUAGES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian", ja: "Japanese", hi: "Hindi", ko: "Korean", zh: "Chinese",
};

const DICT: Record<string, Record<string, string>> = {
  es: { hello: "hola", hi: "hola", hey: "oye", yes: "sí", no: "no", thanks: "gracias", "thank you": "gracias", good: "bueno", great: "genial", friend: "amigo", friends: "amigos", game: "juego", music: "música", food: "comida", love: "amor", today: "hoy", tomorrow: "mañana", night: "noche", morning: "mañana", what: "qué", how: "cómo", are: "estás", you: "tú", i: "yo", the: "el", is: "es", and: "y", so: "tan", very: "muy", cool: "genial", happy: "feliz", see: "ver", later: "luego", play: "jugar", study: "estudiar", homework: "tarea", coffee: "café", new: "nuevo", fun: "divertido", nice: "bonito", anyone: "alguien", who: "quién", tonight: "esta noche" },
  fr: { hello: "bonjour", hi: "salut", hey: "salut", yes: "oui", no: "non", thanks: "merci", "thank you": "merci", good: "bon", great: "génial", friend: "ami", friends: "amis", game: "jeu", music: "musique", food: "nourriture", love: "amour", today: "aujourd'hui", tomorrow: "demain", night: "nuit", morning: "matin", what: "quoi", how: "comment", are: "es", you: "tu", i: "je", the: "le", is: "est", and: "et", very: "très", cool: "cool", happy: "heureux", later: "plus tard", play: "jouer", study: "étudier", homework: "devoirs", coffee: "café", new: "nouveau", fun: "amusant", anyone: "quelqu'un", tonight: "ce soir" },
  de: { hello: "hallo", hi: "hi", hey: "hey", yes: "ja", no: "nein", thanks: "danke", "thank you": "danke", good: "gut", great: "toll", friend: "Freund", friends: "Freunde", game: "Spiel", music: "Musik", food: "Essen", love: "Liebe", today: "heute", tomorrow: "morgen", night: "Nacht", morning: "Morgen", what: "was", how: "wie", are: "bist", you: "du", i: "ich", the: "die", is: "ist", and: "und", very: "sehr", cool: "cool", happy: "glücklich", later: "später", play: "spielen", study: "lernen", homework: "Hausaufgaben", coffee: "Kaffee", new: "neu", fun: "Spaß", anyone: "jemand", tonight: "heute Abend" },
};

export function offlineTranslate(text: string, lang: string): string {
  const dict = DICT[lang];
  if (!dict) return `[${LANGUAGES[lang] ?? lang}] ${text}`;
  return text.replace(/\b(thank you|[a-z']+)\b/gi, (w) => {
    const t = dict[w.toLowerCase()];
    if (!t) return w;
    return w[0] === w[0].toUpperCase() ? t[0].toUpperCase() + t.slice(1) : t;
  });
}

export async function translate(text: string, lang: string, apiKey?: string): Promise<string> {
  if (!apiKey) return offlineTranslate(text, lang);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const res = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: `Translate the user's chat message into ${LANGUAGES[lang] ?? lang}. Reply with only the translation, preserving emoji and tone.`,
    messages: [{ role: "user", content: text }],
  });
  if (res.stop_reason === "refusal") return offlineTranslate(text, lang);
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || text;
}
