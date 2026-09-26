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
