/**
 * data/messages.js
 * All message content for LoveBot.
 * Add new messages by pushing objects into any array below.
 * Format: { t: "message text", c: "category label" }
 */
window.LB = window.LB || {};

window.LB.messages = {

  happy: [
    { t: "You crossed my mind today and it made me smile.",            c: "connection"  },
    { t: "The way you move through the world is quietly extraordinary.", c: "affirmation" },
    { t: "You are allowed to take up space. All the space you need.",   c: "affirmation" },
    { t: "Something about you makes the ordinary feel more alive.",     c: "wonder"      },
    { t: "You deserve the same kindness you give to everyone else.",    c: "affirmation" },
    { t: "I hope you know how rare you actually are.",                  c: "compliment"  },
    { t: "The world is measurably better because you're in it.",        c: "affirmation" },
    { t: "Your presence is a gift, even on the days you forget that.",  c: "compliment"  },
    { t: "There is a quiet strength in you that I deeply admire.",      c: "compliment"  },
    { t: "You are made of the same atoms as distant stars.",            c: "wonder"      },
    { t: "Someone out there is thinking of you right now.",             c: "connection"  },
    { t: "You matter to more people than you'll ever know.",            c: "connection"  },
    { t: "You leave a warmth behind in every room you enter.",          c: "compliment"  },
    { t: "Your story is still being written. The best chapters are ahead.", c: "wonder"  },
    { t: "Every version of you has been worth knowing.",                c: "affirmation" },
    { t: "I hope today gives you back a fraction of what you give the world.", c: "connection" },
    { t: "You are someone people remember. In the best possible way.", c: "compliment"  },
    { t: "Genuinely — what would we do without you?",                  c: "connection"  },
    { t: "You are doing so much better than you give yourself credit for.", c: "affirmation" },
    { t: "The small things you do ripple outward in ways you can't see.", c: "wonder"    },
  ],

  sad: [
    { t: "Take a deep breath. You're doing better than you think.",     c: "breathe"    },
    { t: "It's okay to not be okay. You don't have to perform happiness today.", c: "validation" },
    { t: "You are allowed to rest. You are allowed to feel this.",      c: "validation" },
    { t: "Hard days are part of the story, not the end of it.",         c: "hope"       },
    { t: "You have survived every difficult day so far. That's 100%.",  c: "comfort"    },
    { t: "Whatever you're carrying — you don't have to carry it perfectly.", c: "comfort" },
    { t: "Your feelings are valid. Every single one of them.",          c: "validation" },
    { t: "This feeling is not permanent. You are not stuck here.",      c: "hope"       },
    { t: "In through the nose, out through the mouth. Slower. You're safe.", c: "breathe" },
    { t: "One thing at a time. Just one small next thing.",             c: "breathe"    },
    { t: "Be gentle with yourself right now. You deserve that gentleness.", c: "breathe" },
    { t: "After every storm there is a stillness. You're getting closer to yours.", c: "hope" },
    { t: "The part of you that keeps going is extraordinary.",          c: "hope"       },
    { t: "Even on the hardest days, you are still here. Still trying. That counts.", c: "hope" },
  ],

  stressed: [
    { t: "Breathe. Just the next minute. You don't need to handle more than that.", c: "breathe" },
    { t: "You are allowed to say no. You are allowed to slow down.",    c: "validation" },
    { t: "The chaos outside doesn't have to live inside you.",          c: "breathe"    },
    { t: "You're not behind. You're on your own timeline.",             c: "comfort"    },
    { t: "Put down what you can. Some things can wait. You cannot.",    c: "validation" },
    { t: "You are a person, not a productivity machine. Rest is not failure.", c: "validation" },
    { t: "The pressure you feel is real. And it won't last forever.",   c: "comfort"    },
    { t: "You are doing your best. That is always enough.",             c: "comfort"    },
  ],

  night: [
    { t: "You did enough today. Rest well, gentle soul.",               c: "night" },
    { t: "The stars are out. So is your permission to stop and breathe.", c: "night" },
    { t: "Close your eyes. You've carried enough for one day.",         c: "night" },
    { t: "The night is soft. Let it hold you for a while.",             c: "night" },
    { t: "Tomorrow is a fresh page. But right now — rest.",             c: "night" },
    { t: "You showed up today. That matters. Sleep well.",              c: "night" },
  ],

  /** Short lines kept for TTS / voice-only delivery */
  tts: [
    "I'm proud of you.",
    "I hope you're having a good day.",
    "Don't forget to drink some water.",
    "You are enough, exactly as you are.",
    "Take a moment just for yourself today.",
    "You've got this. I believe in you.",
    "Rest if you need to. You've earned it.",
    "You make the world a warmer place.",
    "I hope something small delights you today.",
    "You are more loved than you know.",
  ],
};

window.LB.statusLines = {
  happy:    ["Feeling your energy ✦", "Glowing with you 🌸", "Your joy is contagious ✨"],
  neutral:  ["Here for you ✦",        "Always beside you 🌙",  "Quietly present ✦"],
  sad:      ["Sitting with you 🌧",   "Holding space for you", "Here, no matter what"],
  stressed: ["Breathe with me 🌀",    "One step at a time ✦",  "I've got you"],
};

window.LB.moodEmojis = { happy:"🌸", neutral:"🌙", sad:"🌧", stressed:"🌀" };
