import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import cron from "node-cron";
import { setupHiddenXp } from "./src/xp/xpListener.js";
import { setupSecretWordTracker } from "./src/secret/secretWordListener.js";

// --- Daily tracking (RAM only) ---
const seenDaily = new Map(); // userId -> dayKey
const lastBTriggerAt = new Map(); // userId -> timestamp (ms)
const PERSON_B_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours (change this)
const lastEggAt = new Map();     // key: guildId:eggIndex -> timestamp
const foundEggs = new Map();     // guildId -> Set(eggIndex) 
const WEEKLY_CHANNEL_ID = process.env.WEEKLY_CHANNEL_ID;
const WEEKLY_CHAMP_ROLE_ID = process.env.WEEKLY_CHAMP_ROLE_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const xpService = setupHiddenXp(client, { cooldownMs: 45_000 });
const secretSvc = setupSecretWordTracker(client, {});
const STATE_PATH = path.join(process.cwd(), "state.json");


// debounce saves so you don’t write on every message
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 500);
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState() {
  const plain = {
    // Map userId -> dayKey
    seenDaily: Object.fromEntries(seenDaily),

    // Map userId -> timestamp
    lastBTriggerAt: Object.fromEntries(lastBTriggerAt),

    // Map guildId -> array of egg indexes
    foundEggs: Object.fromEntries(
      [...foundEggs.entries()].map(([gid, set]) => [gid, [...set]])
    ),
  };

  fs.writeFileSync(STATE_PATH, JSON.stringify(plain, null, 2), "utf8");
}

const restored = loadState();
if (restored) {
  if (restored.seenDaily) {
    for (const [k, v] of Object.entries(restored.seenDaily)) seenDaily.set(k, v);
  }
  if (restored.lastBTriggerAt) {
    for (const [k, v] of Object.entries(restored.lastBTriggerAt)) lastBTriggerAt.set(k, v);
  }
  if (restored.foundEggs) {
    for (const [gid, arr] of Object.entries(restored.foundEggs)) {
      foundEggs.set(gid, new Set(arr));
    }
  }
}


// --- IDs (fill in) ---
const DAILY_USERS = new Map([
  ["1437234470330568726", {
    name: "River",
    replies: [
    "[EN] Everybody kneel, the Pillow Princess is here. [DE] Alle niederknien, die Kissen Princessin ist da.",
    "[EN] Soft landing guaranteed. Authority not optional. [DE] Weiche Landung garantiert. Autorität nicht optional.",
    "[EN] Soft pillows, expressive reactions. [DE] Weiche Kissen, ausdrucksstarke Reaktionen.",
    "[EN] She came to relax and accidentally brought feelings. [DE] Sie kam zum Entspannen und hat aus Versehen Gefühle mitgebracht.",
    "[EN] She looks relaxed, but she definitely cares. [DE] Sie wirkt entspannt, aber es ist ihr definitiv nicht egal.",
    "[EN] Looks cold, reacts warm. Classic Snow Bunny behavior. [DE] Sie wirkt kühl, reagiert aber warm. Klassisches Schnee-Häschen-Verhalten.",
    "[EN] Pillow Princess by nature, Snow Bunny by reputation. [DE] Pillow Princess von Natur aus, Schnee Häschen vom Ruf her.",
    "[EN] Calm like fresh snow, expressive like a bunny. [DE] Ruhig wie frischer Schnee, ausdrucksstark wie ein Häschen.",
    "[EN] Snow Bunny energy: cozy, cute, and emotionally invested. [DE] Schnee Häschen-Energie: gemütlich, süß und emotional dabei.",
  ]}],
  ["340204841617850369", {
    name: "Endless",
    replies: [
  "[EN] Endless is typing… or eating… or both. Probably both. [DE] Endless tippt … oder isst … oder beides. Wahrscheinlich beides.",
  "[EN] Voice message detected. Translation quality: Burgerfinger Edition. [DE] Sprachnachricht erkannt. Übersetzungsqualität: Burgerfinger-Edition.",
  "[EN] Burgerfinger has entered the chat. Please protect your keyboards. [DE] Burgerfinger hat den Chat betreten. Bitte schützt eure Tastaturen.",
  "[EN] I love how every Endless message is a puzzle, not a sentence. [DE] Ich liebe es, wie jede Endless-Nachricht ein Rätsel ist und kein Satz.",
  "[EN] She eats, she speaks, the message suffers. Balance is important. [DE] Sie isst, sie spricht, die Nachricht leidet. Balance ist wichtig.",
  "[EN] Endless really said: grammar is optional when snacks are involved. [DE] Endless sagt wirklich: Grammatik ist optional, wenn Snacks im Spiel sind.",
  "[EN] Grünz would be proud. Or confused. Probably both. [DE] Grünz wäre stolz. Oder verwirrt. Wahrscheinlich beides.",
  "[EN] The prince is named Grünz and honestly that explains everything. [DE] Der Prinz heißt Grünz und ehrlich gesagt erklärt das einfach alles.",
  "[EN] This message was recorded live from the battlefield of food vs phone. [DE] Diese Nachricht wurde live vom Schlachtfeld Essen gegen Handy aufgenommen.",
  "[EN] Burgerfinger strikes again. Somewhere a napkin is crying. [DE] Burgerfinger schlägt wieder zu. Irgendwo weint eine Serviette.",
  "[EN] Endless doesn't type wrong. She types creatively under pressure. [DE] Endless tippt nicht falsch. Sie tippt kreativ unter Druck.",
  "[EN] Her fingers are greasy, her heart is pure, her messages are chaos. [DE] Ihre Finger sind fettig, ihr Herz ist rein, ihre Nachrichten sind Chaos.",
  "[EN] She trains a killer cat on trap while the rest of you struggle with life. [DE] Sie trainiert eine Killerkatze auf Trap, während der Rest von euch mit dem Leben kämpft.",
  "[EN] Grünz is not a typo anymore. It's a lifestyle. [DE] Grünz ist kein Tippfehler mehr. Es ist ein Lebensstil.",
  "[EN] Every Endless message feels like it survived a fight with a burger. [DE] Jede Endless-Nachricht fühlt sich an, als hätte sie einen Kampf mit einem Burger überlebt.",
  "[EN] She multitasks: eating, talking, confusing everyone at once. [DE] Sie multitaskt: essen, reden und alle gleichzeitig verwirren.",
  "[EN] Endless typed something. We will never know what it was supposed to be. [DE] Endless hat etwas getippt. Wir werden nie erfahren, was es eigentlich sein sollte.",
  ]}],
  ["532601068400672819", {
    name: "Hummel",
    replies: [
  "[EN] Hummel has entered the chat. The battlefield is now emotionally and strategically unsafe. [DE] Hummel hat den Chat betreten. Das Schlachtfeld ist jetzt emotional und strategisch unsicher.",
  "[EN] Cute smile detected. Tactical danger confirmed. [DE] Süßes Lächeln erkannt. Taktische Gefahr bestätigt.",
  "[EN] She looks adorable, but don’t be fooled — this one fights for fun. [DE] Sie sieht niedlich aus, aber lass dich nicht täuschen — sie kämpft zum Spaß.",
  "[EN] Killer Hummel costume loading. Mercy not included. [DE] Killer-Hummel-Kostüm wird geladen. Gnade nicht enthalten.",
  "[EN] Hummel doesn’t go to war. She decorates the battlefield with confidence. [DE] Hummel zieht nicht in den Krieg. Sie dekoriert das Schlachtfeld mit Selbstbewusstsein.",
  "[EN] She’s sweet, she’s tough, and she will absolutely sting if needed. [DE] Sie ist süß, sie ist hart im Nehmen und sie sticht definitiv zu, wenn es sein muss.",
  "[EN] When Hummel smiles, someone somewhere should start running. [DE] Wenn Hummel lächelt, sollte irgendwo jemand anfangen zu rennen.",
  "[EN] This is what happens when charm and combat experience share one body. [DE] Das passiert, wenn Charme und Kampferfahrung sich einen Körper teilen.",
  "[EN] Be adorable. Be lethal. Be Hummel. [DE] Sei niedlich. Sei tödlich. Sei Hummel.",
  "[EN] Warning: excessive cuteness hiding violent competence. [DE] Warnung: Übermäßige Niedlichkeit verbirgt gewaltsame Kompetenz.",
  "[EN] Hummel on the battlefield is proof that beauty and chaos can coexist. [DE] Hummel auf dem Schlachtfeld ist der Beweis, dass Schönheit und Chaos koexistieren können.",
  "[EN] Killer Hummel mode activated. Buzzing intensifies. [DE] Killer-Hummel-Modus aktiviert. Summen intensiviert sich.",
  "[EN] Every hummel-phrase sounds cute until you realize it’s a declaration of war. [DE] Jede Hummel-Formulierung klingt niedlich, bis man merkt, dass es eine Kriegserklärung ist.",
  "[EN] Soft outside, steel inside, sting always ready. [DE] Außen weich, innen Stahl, der Stachel immer bereit.",
  "[EN] If elegance was a weapon, Hummel would be unstoppable. Oh wait. [DE] Wenn Eleganz eine Waffe wäre, wäre Hummel unaufhaltsam. Oh, Moment.",
  "[EN] Hummel doesn’t need armor. She wears attitude. [DE] Hummel braucht keine Rüstung. Sie trägt Attitüde.",
  "[EN] She makes war look charming and that’s honestly terrifying. [DE] Sie lässt Krieg charmant aussehen und das ist ehrlich gesagt beängstigend.",
  "[EN] The battlefield just got a lot more hummelig. [DE] Das Schlachtfeld ist gerade deutlich hummeliger geworden.",

  ]}],
  ["1366127307613278351", {
    name: "Kerbos",
    replies: [
  "[EN] He didn't type sooner because he was patiently waiting for this exact moment. [DE] Er hat nicht früher geschrieben, weil er geduldig genau auf diesen Moment gewartet hat.",
  "[EN] Ah yes, that comment. Guess it's time to get the broom. [DE] Ah ja, dieser Kommentar. Zeit, den Besen zu holen.",
  "[EN] He reads quietly, judges silently, and then cleans efficiently. [DE] Er liest leise, urteilt still und räumt dann effizient auf.",
  "[EN] Kerbos has entered the chat with calm disappointment and cleaning supplies. [DE] Kerbos hat den Chat mit ruhiger Enttäuschung und Putzutensilien betreten.",
  "[EN] He's been here the whole time. You just forgot. [DE] Er war die ganze Zeit hier. Du hast es nur vergessen.",
  "[EN] Kerbos is not loud, but his presence is very noticeable when things go wrong. [DE] Kerbos ist nicht laut, aber seine Präsenz ist sehr deutlich spürbar, wenn etwas schiefläuft.",
  "[EN] That moment when loyalty meets quiet authority. [DE] Der Moment, in dem Loyalität auf stille Autorität trifft.",
  "[EN] Sometimes the strongest ones don't talk much. They just act. [DE] Manchmal reden die Stärksten nicht viel. Sie handeln einfach.",
  "[EN] Kerbos is the reason this place still works. [DE] Kerbos ist der Grund, warum das hier überhaupt noch funktioniert.",
  "[EN] He waits, he watches, and then he fixes things. [DE] Er wartet, er beobachtet und dann repariert er die Dinge.",
  "[EN] Someone said something questionable. Kerbos felt it. [DE] Jemand hat etwas Fragwürdiges gesagt. Kerbos hat es gespürt.",
  "[EN] Calm voice, strong spine, loyal to the core. [DE] Ruhige Stimme, starker Rückgrat, loyal bis ins Mark.",
  "[EN] Kerbos doesn't need many words. One sentence is usually enough. [DE] Kerbos braucht nicht viele Worte. Ein Satz reicht meistens.",
  "[EN] If Kerbos says we need him, you listen. [DE] Wenn Kerbos sagt, dass man ihn braucht, hört man zu.",
  "[EN] The broom isn't a threat. It's a promise. [DE] Der Besen ist keine Drohung. Er ist ein Versprechen.",
  "[EN] Kerbos doesn't look for attention. Attention finds him when chaos appears. [DE] Kerbos sucht keine Aufmerksamkeit. Die Aufmerksamkeit findet ihn, wenn Chaos entsteht.",
  "[EN] This chat survives because Kerbos is here. [DE] Dieser Chat überlebt, weil Kerbos hier ist.",
  ]}],
  ["315502724731109377", {
    name: "Imiko",
    replies: [
  "[EN] Imiko wrote something, which means the system is stable. For now. [DE] Imiko hat etwas geschrieben, was bedeutet, dass das System stabil ist. Vorerst.",
  "[EN] Reminder: this chat exists because Imiko built it. Be nice. [DE] Erinnerung: Dieser Chat existiert, weil Imiko ihn gebaut hat. Seid nett.",
  "[EN] IT nerd detected. Fun optimized, sleep schedule respected. [DE] IT-Nerd erkannt. Spaß optimiert, Schlafrhythmus respektiert.",
  "[EN] Imiko believes in good vibes, good code, and going to bed on time. [DE] Imiko glaubt an gute Vibes, guten Code und pünktlich ins Bett gehen.",
  "[EN] If it's past 10 PM, Imiko is already emotionally asleep. [DE] Wenn es nach 22 Uhr ist, schläft Imiko emotional bereits.",
  "[EN] Weekend Imiko is wild. By wild, we mean awake until 1 AM. [DE] Wochenend-Imiko ist wild. Mit wild meinen wir wach bis 1 Uhr nachts.",
  "[EN] He upgrades the soundboard and downgrades the stress level. [DE] Er verbessert das Soundboard und senkt gleichzeitig das Stresslevel.",
  "[EN] Imiko plays for fun, not for fame. Revolutionary concept. [DE] Imiko spielt zum Spaß, nicht für Ruhm. Revolutionäres Konzept.",
  "[EN] The code is clean, the priorities are healthier than most. [DE] Der Code ist sauber, die Prioritäten gesünder als bei den meisten.",
  "[EN] Soundboard improved, sleep schedule untouched. [DE] Soundboard verbessert, Schlafrhythmus unberührt.",
  "[EN] If Imiko is online late, something has gone terribly wrong. [DE] Wenn Imiko spät online ist, ist etwas gewaltig schiefgelaufen.",
  "[EN] IT brain, soft heart, strict bedtime. [DE] IT-Gehirn, weiches Herz, strikte Schlafenszeit.",
  "[EN] He fixes bugs, breaks silence, and then goes to sleep. [DE] Er fixt Bugs, bricht das Schweigen und geht dann schlafen.",
  "[EN] Imiko is proof that being good at games is optional, having fun is not. [DE] Imiko ist der Beweis, dass gut in Spielen zu sein optional ist, Spaß zu haben aber nicht.",
  "[EN] The bot works because Imiko cares. [DE] Der Bot funktioniert, weil Imiko sich kümmert.",
  "[EN] He codes like a professional and plays like it's supposed to be fun. [DE] Er coded wie ein Profi und spielt so, wie es Spaß machen soll.",
  "[EN] Imiko doesn't stay up all night. He values his sanity. [DE] Imiko bleibt nicht die ganze Nacht wach. Er schätzt seine geistige Gesundheit.",
  "[EN] Imiko operates on one brain cell, but it's highly optimized and well documented. [DE] Imiko arbeitet mit nur einer Gehirnzelle, aber sie ist hochoptimiert und gut dokumentiert.",
  "[EN] He may have only one brain cell, but it runs on enterprise-grade efficiency. [DE] Er mag nur eine Gehirnzelle haben, aber sie läuft mit Enterprise-Niveau-Effizienz.",
  "[EN] Imiko's single brain cell handles coding, fun, and bedtime scheduling flawlessly. [DE] Imikos einzelne Gehirnzelle übernimmt Coding, Spaß und Schlafenszeit-Planung fehlerfrei.",
  "[EN] That one brain cell is doing more work than most teams combined. [DE] Diese eine Gehirnzelle leistet mehr Arbeit als die meisten Teams zusammen.",
  ]}],
]);

const PERSON_B_ID = "717450712136679517"; // Keksqueen


// --- Person B trigger ---
const PERSON_B_TRIGGERS = ["Bier", "Beer"]; // case-insensitive anyway

// --- Responses ---
const PERSON_B_RESPONSES = [
  "[EN] Obviously... [DE] War ja klar...",
  "[EN] Have you tried Water? [DE] Mal Wasser probiert?",
  "[EN] I'm speechless... [DE] Ich finde keine worte mehr...",
  "[EN] You know what... why not? [DE] Weißt du was... warum nicht?",
  "[EN] Bavarian Beer > your Pisswater [DE] Bayrisches Bier > euer Pisswasser",
  "[EN] Confucius once said: Those who drink a lot may die earlier, but they also see twice as much in life. [DE] Konfuzius sagte mal: Wer viel trinkt, stirbt zwar früher, hat aber dafür auch im Leben doppelt so viel gesehen.",
  "[EN] The wise man drinks his beer thoughtfully, but the fool drinks through the night. [DE] Der Weise trinkt sein Bier mit Bedacht, doch der Narr trinkt die ganze Nacht.",
  "[EN] Ah, beer again. At this point I'm not even surprised, just mildly concerned for tomorrow-you. [DE] Ach, schon wieder Bier. Inzwischen bin ich nicht mal mehr überrascht, nur etwas besorgt um dein morgiges Ich.",
  "[EN] Beer has entered the chat, which means logic has officially left the building. [DE] Bier hat den Chat betreten, was bedeutet, dass die Logik offiziell das Gebäude verlassen hat.",
  "[EN] Interesting strategy: replace thoughts with beer and hope for the best. [DE] Interessante Strategie: Gedanken durch Bier ersetzen und auf das Beste hoffen.",
  "[EN] Every time you write beer, a fridge somewhere opens itself in fear. [DE] Jedes Mal, wenn du Bier schreibst, öffnet sich irgendwo aus Angst ein Kühlschrank.",
  "[EN] I see you chose beer instead of making good decisions again. Bold. Consistent. [DE] Ich sehe, du hast dich wieder für Bier statt für gute Entscheidungen entschieden. Mutig. Konsequenter Stil.",
  "[EN] Beer is not a personality trait, but you are working very hard to prove me wrong. [DE] Bier ist kein Persönlichkeitsmerkmal, aber du gibst dir wirklich Mühe, mir das Gegenteil zu beweisen.",
  "[EN] Once again, beer solves problems that did not need to exist in the first place. [DE] Mal wieder löst Bier Probleme, die von Anfang an gar nicht hätten existieren müssen.",
  "[EN] This message was sponsored by poor life choices and questionable beverages. [DE] Diese Nachricht wurde gesponsert von fragwürdigen Lebensentscheidungen und noch fragwürdigeren Getränken.",
  "[EN] Ah yes, beer. Because water is clearly too mainstream for you. [DE] Ah ja, Bier. Weil Wasser für dich offenbar viel zu mainstream ist.",
  "[EN] The moment beer appears, this chat becomes 37% louder and 80% less responsible. [DE] In dem Moment, in dem Bier auftaucht, wird dieser Chat 37 % lauter und 80 % unverantwortlicher.",
  "[EN] Beer detected. Neko Piccoli is now switching to sarcasm-only mode. [DE] Bier erkannt. Neko Piccoli schaltet jetzt in den reinen Sarkasmusmodus.",
  "[EN] I am not saying beer is the answer, but you sure keep using it like one. [DE] Ich sage nicht, dass Bier die Antwort ist, aber du benutzt es verdächtig oft so.",
  "[EN] You type beer with the confidence of someone who will regret everything tomorrow. [DE] Du schreibst Bier mit der Überzeugung von jemandem, der morgen alles bereuen wird.",
  "[EN] At this point I assume beer is just autocorrect for your personality. [DE] An diesem Punkt gehe ich davon aus, dass Bier einfach die Autokorrektur für deine Persönlichkeit ist.",
  "[EN] Science confirms: every beer message makes the next message worse. [DE] Die Wissenschaft bestätigt: Jede Bier-Nachricht macht die nächste noch schlimmer.",
  "[EN] Beer again? Amazing. Truly a masterclass in consistency. [DE] Schon wieder Bier? Beeindruckend. Eine wahre Meisterklasse in Konsequenz.",
  "[EN] One day historians will find this chat and say: wow, they really loved beer. [DE] Eines Tages werden Historiker diesen Chat finden und sagen: Wow, die haben Bier wirklich geliebt.",
  "[EN] I like how beer is your solution, your excuse, and your emotional support animal. [DE] Ich mag, wie Bier gleichzeitig deine Lösung, deine Ausrede und dein emotionales Support-Tier ist.",
  "[EN] This conversation was going fine until beer showed up like an uninvited guest. [DE] Dieses Gespräch lief eigentlich ganz gut, bis Bier wie ein ungeladener Gast auftauchte.",
  "[EN] If beer was a spell, you would be a max-level wizard by now. [DE] Wenn Bier ein Zauber wäre, wärst du inzwischen ein Magier auf Maximalstufe.",
];



function berlinDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}


function containsTrigger(content, triggers) {
  const text = content.toLowerCase();
  return triggers.some((t) => text.includes(t.toLowerCase()));
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const EASTER_EGGS = [
  {
    // triggers if message contains any of these words
    triggers: ["neko"],
    // replies (random)
    replies: [
      "Meow?",
    ],
    // cooldown so it can’t spam (per guild)
    cooldownMs: 10 * 60 * 1000, // 10 min
  },
  {
    triggers: ["404", "not found", "nicht gefunden"],
    replies: [
      "[EN] I looked everywhere. Still missing. [DE] Überall gesucht. Immer noch weg.",
      "[EN] That's a 404 moment. [DE] Das ist ein 404-Moment.",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
    {
    triggers: ["drama"],
    replies: [
      "[EN] We should pitch your dramas to Netflix... Infinite money glitch. [DE] Wir sollten eure Dramen an Netflix pitchen... Infinite money glitch.",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["sleep", "schlaf", "Sleep", "Schlaf"],
    replies: [
      "[EN] You should feel lucky, I may only shut my eyes when @Imiko restarts me... FOR 10 SECONDS!!!! [DE] Ihr könnt euch glücklich schätzen, ich schließe meine Augen nur, wenn @Imiko mich neu startet... FÜR 10 SEKUNDEN!!!!",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["siege", "Siege"],
    replies: [
      "[EN] Oh yea... Imiko loves Rainbow 6 Siege, he used to compete in tournaments and was in the top 0.1% multiple times [DE] Oh ja... Imiko liebt Rainbow Six Siege, er hat bei Turniere mitgemacht und war öfter unter den Top 0.1%",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["Marvel", "marvel"],
    replies: [
      "[EN] Probably the most iconic cartoon franchise who is hated by it's original fans and loved by the new generation [DE] Vermutlich die ikonischste Zeichentrickserie, die von ihren ursprünglichen Fans gehasst und von der neuen Generation geliebt wird.",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["protein", "Protein"],
    replies: [
      "[EN] I love PROTEIN!!! GIVE ME RED MEAT RAAAWRR... I mean... Meow :3? [DE] Ich liebe PROTEIN!!! GIB MIR ROTES FLEISCH RAAAWRR... Ich meine... Miau :3?",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["hidden", "Hidden", "versteckt", "Versteckt"],
    replies: [
      "[EN] You know what else is well hidden? Exactly... NOTHING... Because Imiko can't stop helping you guys... [DE] Wisst ihr, was sonst noch gut verborgen ist? Genau... NICHTS... Denn Imiko kann einfach nicht aufhören, euch zu helfen...",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
  {
    triggers: ["GBSB"],
    replies: [
      "[EN] Did you know we have our own Drama? Keksqueen wrote one of our Journey check it out here: <#1452057948066025502>\n [DE] Wusstest du, dass wir unser eigenes Drama haben? Keksqueen hat von unsere Reise ein Drama geschrieben. Schau es dir hier an: <#1452057948066025502>\n",
    ],
    cooldownMs: 5 * 60 * 1000,
  },
    {
    triggers: ["Penis", "Dick"],
    replies: [
      "<:penisuwu:1475933479874072616>",
    ],
    cooldownMs: 1,
  },
  {
  triggers: ["benis"],
  imagePath: "./assets/benis.png",
  cooldownMs: 1,
}
];


// --- Message reactions (A + B) ---
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const today = berlinDayKey();
  const userId = message.author.id;
 
// --- Easter eggs (anyone) ---
for (let i = 0; i < EASTER_EGGS.length; i++) {
  const egg = EASTER_EGGS[i];

  const key = `${message.guild.id}:${i}`;
  const last = lastEggAt.get(key) ?? 0;

  if (Date.now() - last < egg.cooldownMs) continue;

  if (containsTrigger(message.content, egg.triggers)) {
    lastEggAt.set(key, Date.now());

    const set = foundEggs.get(message.guild.id) ?? new Set();
    set.add(i);
    foundEggs.set(message.guild.id, set);
    scheduleSave();

    if (egg.imagePath) {
  const attachment = new AttachmentBuilder(egg.imagePath);
  await message.reply({ files: [attachment] });
} else {
  await message.reply(randomFrom(egg.replies));
}
    break;
  }
}

const daily = DAILY_USERS.get(userId);
if (daily) {
  if (seenDaily.get(userId) !== today) {
    seenDaily.set(userId, today);
    scheduleSave();
    await message.reply(randomFrom(daily.replies));
  }
  return;
}


  if (userId === PERSON_B_ID) {
  const now = Date.now();
  const last = lastBTriggerAt.get(userId) ?? 0;

  if (now - last < PERSON_B_COOLDOWN_MS) return; // still on cooldown

  if (containsTrigger(message.content, PERSON_B_TRIGGERS)) {
    lastBTriggerAt.set(userId, now);
    scheduleSave();
    await message.reply(randomFrom(PERSON_B_RESPONSES));
  }
}
});

async function fetchMotd() {
  const res = await fetch("https://meme-api.com/gimme/memes", {
    headers: { "user-agent": "NekoPiccoliBot/1.0" },
  });

  if (!res.ok) throw new Error(`Meme API HTTP ${res.status}`);

  const data = await res.json();
  return {
    title: data.title ?? "Meme of the day",
    url: data.url,                  // <-- matches .setImage(meme.url)
    postLink: data.postLink ?? "",
  };
}


client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // --- /motd ---
  if (interaction.commandName === "motd") {
    await interaction.deferReply();
    try {
      const meme = await fetchMotd();

      const embed = new EmbedBuilder()
        .setTitle("🗓️ Meme of the day")
        .setDescription(meme.title ?? "Enjoy 😄")
        .setImage(meme.url)
        .setFooter({ text: meme.postLink ?? "" });

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error("MOTD error:", e);
      await interaction.editReply(`⚠️ MOTD fetch failed: ${e?.message ?? e}`);
    }
  }
    
    else if (interaction.commandName === "title") {
  const row = xpService.getUser(interaction.guildId, interaction.user.id);
  const title = row?.title?.trim();

  await interaction.reply({
    content: title
      ? `🪪 **Your secret title:** ${title}`
      : `🪪 **Your secret title:** —\nKeep chatting. Something might unlock later 👀`,
    ephemeral: false,
  });
}

else if (interaction.commandName === "leaderboard") {
  const top = secretSvc.getTop(interaction.guildId, 10);

  if (!top.length) {
    return interaction.reply({
      content: "🏆 **Mystery Leaderboard**\nNo hits recorded yet… 👀",
      ephemeral: false,
    });
  }

  const lines = top.map((r, i) => `${i + 1}. <@${r.user_id}> — **${r.score}**`);

  await interaction.reply({
    content: `🏆 **Mystery Leaderboard**\n${lines.join("\n")}`,
    allowedMentions: { users: [] }, // prevents pings
    ephemeral: false,                // keep it “secret”; set false if you want it public
  });
}
  
  // --- /stats ---
else if (interaction.commandName === "stats") {
  const today = berlinDayKey();

  const entries = [...DAILY_USERS.entries()];

  const done = entries.filter(([id]) => seenDaily.get(id) === today);
  const todo = entries.filter(([id]) => seenDaily.get(id) !== today);

const doneNames = done.map(([, v]) => v?.name).filter(Boolean).join(", ") || "—";
const todoNames = todo.map(([, v]) => v?.name).filter(Boolean).join(", ") || "—";
const foundSet = foundEggs.get(interaction.guildId) ?? new Set();
const eggsFound = foundSet.size;
const eggsTotal = EASTER_EGGS.length;


  const now = Date.now();
  const lastB = lastBTriggerAt.get(PERSON_B_ID) ?? 0;
  const msLeft = Math.max(0, PERSON_B_COOLDOWN_MS - (now - lastB));
  const minsLeft = Math.ceil(msLeft / 60000);

  const lines = [
    `📅 **Current date (CET) / Aktuelles Datum (MEZ):** ${today}`,
    ``,
    `👋 **Daily greets / Tägliche Begrüßung:** ${done.length}/${entries.length}`,
    `✅ **Done / Erledigt:** ${doneNames}`,
    `⏳ **Not yet / Noch nicht:** ${todoNames}`,
    `🥚 **Easter eggs found / Gefundene Easter Eggs:** ${eggsFound}/${eggsTotal}`,
    `🍺 **Keksqueen cooldown / Abklingzeit:** ${
      msLeft === 0 ? "ready ✅ / bereit ✅" : `~${minsLeft} min`
    }`,
  ];

  await interaction.reply({
    content: lines.join("\n"),
    allowedMentions: { parse: [] }, // extra safety: no pings ever
  });
}
});




const TIMEZONE = "Europe/Berlin";
const DATA_FILE = path.join(process.cwd(), "schedule.json");

function loadSchedule() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveSchedule(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}


client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // --- Load / init schedule.json ---
  let schedule = loadSchedule();
  if (!schedule) schedule = {};

  // startDate (anchor) - only set if missing
  if (!schedule.startDate) {
    const todayKey = berlinDayKey(new Date()); // "YYYY-MM-DD" in Europe/Berlin
    const anchored = new Date(`${todayKey}T00:00:00`);
    schedule.startDate = anchored.toISOString();
  }

  // sent markers: { "YYYY-MM-DD": { "20:00": true, "20:25": true } }
  if (!schedule.sent) schedule.sent = {};

  // persist any init changes
  saveSchedule(schedule);

  // load secret words from the mounted DB folder (same mount as sqlite)
function loadSecretWords() {
  const p = "/app/data/secret-words.json";
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  return Array.isArray(data.words) ? data.words.filter(Boolean) : [];
}
  
  const startDate = new Date(schedule.startDate);

  async function rotateWeeklySecretWord() {
    if (!WEEKLY_CHANNEL_ID || !WEEKLY_CHAMP_ROLE_ID) {
      console.error("Missing WEEKLY_CHANNEL_ID or WEEKLY_CHAMP_ROLE_ID in env.");
      return;
    }

    const words = loadSecretWords();
    if (!words.length) {
      console.error("secret-words.json has no words.");
      return;
    }

    for (const [guildId, guild] of client.guilds.cache) {
      const top = secretSvc.getTop(guildId, 3);

      const channel = await client.channels.fetch(WEEKLY_CHANNEL_ID).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      if (!top.length) {
        await channel.send("🏁 **Weekly Mystery Results**\nNo one found the word this week… suspicious 👀");
      } else {
        const lines = top.map((r, i) => `${i + 1}. <@${r.user_id}> — **${r.score}**`);
        await channel.send(`🏁 **Weekly Mystery Results**\n${lines.join("\n")}`);

        const champUserId = top[0].user_id;
        const member = await guild.members.fetch(champUserId).catch(() => null);
        const role = guild.roles.cache.get(WEEKLY_CHAMP_ROLE_ID) ?? null;

        if (member && role) {
          for (const [, m] of role.members) {
            await m.roles.remove(role).catch(() => null);
          }
          await member.roles.add(role).catch(() => null);
        }
      }

      const current = secretSvc.getCurrentWord(guildId);
      let next = words[Math.floor(Math.random() * words.length)];

      if (words.length > 1) {
        while (next === current) {
          next = words[Math.floor(Math.random() * words.length)];
        }
      }

      secretSvc.setCurrentWord(guildId, next);
      secretSvc.resetScores(guildId);

      await channel.send("🔄 A new Mystery Word has been chosen for this week. Happy accidents, everyone.");
    }
  }

  for (const [guildId] of client.guilds.cache) {
    const currentWord = secretSvc.getCurrentWord(guildId);

    if (!currentWord) {
      const words = loadSecretWords();
      if (words.length) {
        const firstWord = words[Math.floor(Math.random() * words.length)];
        secretSvc.setCurrentWord(guildId, firstWord);
        console.log(`Initialized first secret word for guild ${guildId}`);
      }
    } else {
      secretSvc.setCurrentWord(guildId, currentWord);
    }
  }
  
  cron.schedule(
    "5 0 * * 1",
    async () => {
      await rotateWeeklySecretWord();
    },
    { timezone: TIMEZONE }
  );
});

client.login(process.env.DISCORD_TOKEN);



















