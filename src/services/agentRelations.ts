/**
 * Resolves relationship words ("my mom", "আম্মু", "baba", "my wife") to the
 * user's own connects, using the relationship tags people set on a connect
 * (Parent, Sibling, Spouse, ...) plus the connect's gender to tell, e.g.,
 * mom from dad when both are tagged "Parent".
 */

export type RelationConnect = {
  id: string;
  name: string;
  profilePic?: string;
  relationshipTypes?: string[];
  gender?: string;
};

type Relation = {
  label: string;
  words: string[];
  /** Relationship tags that fit, most specific first. */
  types: string[];
  gender?: 'female' | 'male';
};

const RELATIONS: Relation[] = [
  {
    label: 'mom',
    words: ['mom', 'mommy', 'mum', 'mother', 'ma', 'maa', 'amma', 'ammu', 'ammi', 'mummy', 'মা', 'আম্মু', 'আম্মা', 'আম্মি', 'মাম্মি', 'মাকে', 'আম্মুকে', 'আম্মাকে'],
    types: ['mother', 'mom', 'parent', 'family'],
    gender: 'female',
  },
  {
    label: 'dad',
    words: ['dad', 'daddy', 'father', 'papa', 'abba', 'abbu', 'baba', 'বাবা', 'আব্বু', 'আব্বা', 'পাপা', 'বাবাকে', 'আব্বুকে', 'আব্বাকে'],
    types: ['father', 'dad', 'parent', 'family'],
    gender: 'male',
  },
  {
    label: 'brother',
    words: ['brother', 'bro', 'bhaiya', 'vaiya', 'ভাইয়া', 'ভাইয়া', 'ভাইকে', 'ভাইয়াকে'],
    types: ['brother', 'sibling', 'family', 'relative'],
    gender: 'male',
  },
  {
    label: 'sister',
    words: ['sister', 'sis', 'bon', 'বোন', 'বোনকে', 'আপুকে'],
    types: ['sister', 'sibling', 'family', 'relative'],
    gender: 'female',
  },
  {
    label: 'wife',
    words: ['wife', 'bou', 'biwi', 'বউ', 'বৌ', 'স্ত্রী', 'বউকে', 'বৌকে'],
    types: ['wife', 'spouse', 'partner'],
    gender: 'female',
  },
  {
    label: 'husband',
    words: ['husband', 'swami', 'jamai', 'স্বামী', 'জামাই', 'স্বামীকে'],
    types: ['husband', 'spouse', 'partner'],
    gender: 'male',
  },
  {
    label: 'son',
    words: ['son', 'chele', 'ছেলে', 'ছেলেকে'],
    types: ['son', 'child', 'family'],
    gender: 'male',
  },
  {
    label: 'daughter',
    words: ['daughter', 'meye', 'মেয়ে', 'মেয়ে', 'মেয়েকে', 'মেয়েকে'],
    types: ['daughter', 'child', 'family'],
    gender: 'female',
  },
  {
    label: 'best friend',
    words: ['best friend', 'bestfriend', 'bff', 'বেস্ট ফ্রেন্ড', 'প্রিয় বন্ধু'],
    types: ['best friend'],
  },
  {
    label: 'partner',
    words: ['partner', 'girlfriend', 'boyfriend', 'gf', 'bf'],
    types: ['partner', 'dating', 'fiance', 'spouse'],
  },
];

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‌‍]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    // "my mom", "amar ammu", "আমার মা", "mom's"
    .replace(/^(my|amar|আমার)\s+/u, '')
    .replace(/\s+/g, ' ')
    // "mom's" becomes "mom s" once the apostrophe is stripped.
    .replace(/ s$/, '')
    .trim();

/** The relation a spoken name refers to, or null for an ordinary name. */
export const findRelation = (spokenName: string): Relation | null => {
  const needle = normalize(spokenName);
  if (!needle) return null;
  return RELATIONS.find(relation => relation.words.includes(needle)) || null;
};

const genderOf = (value?: string): 'female' | 'male' | '' => {
  const text = String(value || '').trim().toLowerCase();
  if (/^(f|female|woman|mohila|মহিলা|নারী)/.test(text)) return 'female';
  if (/^(m|male|man|purush|পুরুষ)/.test(text)) return 'male';
  return '';
};

/**
 * Connects that fit a relationship word, best match first. Returns null when
 * the spoken name is not a relationship word at all.
 */
export const matchRelationConnects = (
  spokenName: string,
  connects: RelationConnect[],
): { relation: Relation; matches: RelationConnect[] } | null => {
  const relation = findRelation(spokenName);
  if (!relation) return null;
  const tagged = (connect: RelationConnect) =>
    (connect.relationshipTypes || []).map(type => type.trim().toLowerCase());

  // Most specific tag first: "Mother" beats "Parent" beats "Family".
  for (const type of relation.types) {
    let matches = connects.filter(connect => tagged(connect).includes(type));
    if (!matches.length) continue;
    if (relation.gender && matches.length > 1) {
      const sameGender = matches.filter(
        connect => genderOf(connect.gender) === relation.gender,
      );
      const unknownGender = matches.filter(connect => !genderOf(connect.gender));
      matches = sameGender.length ? sameGender : unknownGender.length ? unknownGender : matches;
    } else if (relation.gender && matches.length === 1) {
      // A single "Parent" tagged as the other gender is not a match.
      const only = genderOf(matches[0].gender);
      if (only && only !== relation.gender) continue;
    }
    if (matches.length) return { relation, matches };
  }
  return { relation, matches: [] };
};

/** Relationship tags a connection can carry (matches the relationship pickers). */
export const RELATIONSHIP_OPTIONS = [
  'Friend', 'Best Friend', 'Family', 'Parent', 'Child', 'Sibling', 'Relative',
  'Partner', 'Spouse', 'Fiance', 'Dating', 'Ex-Partner', 'Neighbor',
  'Colleague', 'Manager', 'Mentor', 'Mentee', 'Classmate', 'Teacher', 'Student',
  'Business Partner', 'Client', 'Customer', 'Professional Contact',
  'Teammate', 'Club Member', 'Community Member', 'Roommate', 'Healthcare Provider',
  'Caregiver', 'Emergency Contact',
];

/** Spoken words that mean one of the relationship tags above. */
const RELATIONSHIP_SYNONYMS: Record<string, string[]> = {
  Friend: ['friend', 'friends', 'bondhu', 'বন্ধু', 'dost'],
  'Best Friend': ['best friend', 'bestfriend', 'bff', 'বেস্ট ফ্রেন্ড', 'প্রিয় বন্ধু'],
  Family: ['family', 'poribar', 'পরিবার'],
  Parent: ['parent', 'parents', 'mom', 'mother', 'mum', 'ma', 'ammu', 'amma', 'dad', 'father', 'papa', 'abbu', 'abba', 'baba', 'মা', 'আম্মু', 'বাবা', 'আব্বু'],
  Child: ['child', 'children', 'kid', 'son', 'daughter', 'chele', 'meye', 'ছেলে', 'মেয়ে', 'সন্তান'],
  Sibling: ['sibling', 'siblings', 'brother', 'sister', 'bhai', 'bhaiya', 'bon', 'apu', 'ভাই', 'ভাইয়া', 'বোন', 'আপু'],
  Relative: ['relative', 'relatives', 'cousin', 'uncle', 'aunt', 'aunty', 'mama', 'chacha', 'khala', 'fufu', 'nana', 'nani', 'dada', 'dadi', 'আত্মীয়'],
  Partner: ['partner', 'girlfriend', 'boyfriend', 'gf', 'bf'],
  Spouse: ['spouse', 'wife', 'husband', 'bou', 'biwi', 'swami', 'বউ', 'স্ত্রী', 'স্বামী'],
  Fiance: ['fiance', 'fiancee', 'fiancé', 'fiancée', 'engaged', 'বাগদত্তা'],
  'Ex-Partner': ['ex', 'ex partner', 'ex-partner', 'ex girlfriend', 'ex boyfriend'],
  Neighbor: ['neighbor', 'neighbour', 'protibeshi', 'প্রতিবেশী'],
  Colleague: ['colleague', 'coworker', 'co-worker', 'office friend', 'সহকর্মী'],
  Manager: ['manager', 'boss', 'বস'],
  Teacher: ['teacher', 'sir', 'madam', 'shikkhok', 'শিক্ষক'],
  Student: ['student', 'chatro', 'ছাত্র', 'ছাত্রী'],
  Classmate: ['classmate', 'class mate', 'সহপাঠী'],
  Roommate: ['roommate', 'room mate', 'flatmate'],
  'Emergency Contact': ['emergency contact', 'emergency'],
};

const normalizeTag = (value: string) =>
  String(value || '').normalize('NFC').toLowerCase().replace(/[_\s]+/g, ' ').trim();

/**
 * Maps spoken relationship words to the app's relationship tags, keeping any
 * custom tag (the pickers allow "Other") in Title Case. Duplicates removed.
 */
export const normalizeRelationshipTypes = (values: unknown): string[] => {
  const list = Array.isArray(values)
    ? values
    : String(values ?? '')
        .split(/,|\band\b|\/|&|\s(?:এবং|ও)\s/)
        .map(item => item.trim());
  const result: string[] = [];
  for (const item of list) {
    const text = normalizeTag(String(item ?? '')).replace(/^(my|a|an|as|amar|আমার)\s+/, '');
    if (!text) continue;
    const option =
      RELATIONSHIP_OPTIONS.find(candidate => normalizeTag(candidate) === text) ||
      Object.entries(RELATIONSHIP_SYNONYMS).find(([, words]) =>
        words.some(word => normalizeTag(word) === text),
      )?.[0] ||
      text.replace(/(^|\s)\S/g, letter => letter.toUpperCase());
    if (!result.some(existing => normalizeTag(existing) === normalizeTag(option))) {
      result.push(option);
    }
  }
  return result;
};

/**
 * Applies a relationship change. `mode` "add" keeps existing tags, "remove"
 * drops the named ones and "set" (default) replaces them.
 */
export const applyRelationshipChange = (
  current: string[],
  requested: string[],
  mode: 'set' | 'add' | 'remove' = 'set',
): string[] => {
  const same = (a: string, b: string) => normalizeTag(a) === normalizeTag(b);
  if (mode === 'remove') {
    return current.filter(tag => !requested.some(item => same(item, tag)));
  }
  if (mode === 'add') {
    return [
      ...current,
      ...requested.filter(item => !current.some(tag => same(item, tag))),
    ];
  }
  return requested;
};
