const ICEBREAKERS = [
  { en: "What's one good thing that happened today?", bn: 'আজকের একটা ভালো খবর কী?' },
  { en: "Drop a photo of what you're eating.", bn: 'এখন যা খাচ্ছো তার একটা ছবি দাও।' },
  { en: 'What song is stuck in your head?', bn: 'মাথায় কোন গান ঘুরছে?' },
  { en: "One thing you're grateful for right now.", bn: 'এই মুহূর্তে কিসের জন্য কৃতজ্ঞ?' },
  { en: 'Unpopular opinion — go.', bn: 'একটা unpopular opinion বলো।' },
  { en: 'What are you learning this week?', bn: 'এই সপ্তাহে কী শিখছো?' },
  { en: 'Who made you smile today?', bn: 'আজ কে তোমাকে হাসিয়েছে?' },
  { en: 'Caption this: your current mood.', bn: 'এখনকার মুডটা ক্যাপশন করো।' },
  { en: 'Recommend one place in your city.', bn: 'তোমার শহরের একটা জায়গা রেকমেন্ড করো।' },
  { en: 'Tea or coffee — and why?', bn: 'চা নাকি কফি — কেন?' },
  { en: "What's on your mind that you haven't posted?", bn: 'যা ভাবছো কিন্তু পোস্ট করোনি?' },
  { en: 'Share a win, even a tiny one.', bn: 'একটা জয় শেয়ার করো, ছোট হলেও চলবে।' },
  { en: 'Photo of the sky right now.', bn: 'এখনকার আকাশের একটা ছবি।' },
  { en: 'What would you tell yesterday-you?', bn: 'গতকালের নিজেকে কী বলতে?' },
  { en: "One emoji for today. That's the post.", bn: 'আজকের জন্য একটা ইমোজি — সেটাই পোস্ট।' },
];

const dayIndex = (list: typeof ICEBREAKERS) => {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86400000);
  return list[day % list.length];
};

export const getDailyIcebreaker = () => dayIndex(ICEBREAKERS);

export const formatBilingualPrompt = (prompt: { en: string; bn: string }) =>
  `${prompt.en}\n${prompt.bn}`;

export const isoDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
