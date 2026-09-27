import type { Helpline, RecoveryLang, ToolKey } from '../../services/recoveryApi';
import type { IconName } from '../fitness/ui';

// Bundled copies of the safety-critical content so SOS and Help work on the very
// first launch and without internet. The server (GET /recovery/content) is the
// source of truth and overrides these once cached. Keep in sync with
// server/utils/recoveryContent.js; numbers last checked Sept 2026.
const helplines = (lang: RecoveryLang): Helpline[] => {
  const bn = lang === 'bn';
  return [
    {
      key: 'emergency',
      phone: '999',
      display: '999',
      kind: 'emergency',
      crisis: true,
      name: bn ? 'জাতীয় জরুরি সেবা' : 'National Emergency Service',
      description: bn
        ? 'পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স। ওভারডোজ, বুকে ব্যথা, খিঁচুনি বা কারো জীবনের ঝুঁকি থাকলে।'
        : 'Police, fire service and ambulance. For overdose, chest pain, seizures or if anyone is in danger.',
      hours: bn ? '২৪ ঘণ্টা' : '24/7',
    },
    {
      key: 'kaan_pete_roi',
      phone: '09612119911',
      display: '09612-119911',
      kind: 'mental_health',
      crisis: true,
      url: 'https://kaanpeteroi.org',
      name: bn ? 'কান পেতে রই' : 'Kaan Pete Roi',
      description: bn
        ? 'মানসিক সহায়তা ও আত্মহত্যা প্রতিরোধ হেল্পলাইন। গোপনীয়, কোনো বিচার করা হয় না।'
        : 'Emotional support and suicide prevention. Confidential and without judgement.',
      hours: bn ? 'প্রতিদিন দুপুর ৩টা – রাত ৩টা' : '3 pm – 3 am, every day',
    },
    {
      key: 'shastho_batayon',
      phone: '16263',
      display: '16263',
      kind: 'health',
      crisis: false,
      name: bn ? 'স্বাস্থ্য বাতায়ন' : 'Shastho Batayon',
      description: bn
        ? 'সরকারি স্বাস্থ্য কল সেন্টার: ডাক্তারের পরামর্শ, মানসিক স্বাস্থ্য পরামর্শ ও রেফারেল।'
        : 'Government health call centre: talk to a doctor and get mental-health advice and referral.',
      hours: '',
    },
    {
      key: 'talk_hope',
      phone: '+8809638881888',
      display: '09638-881888',
      kind: 'mental_health',
      crisis: false,
      name: bn ? 'টক হোপ' : 'Talk Hope',
      description: bn ? 'কাউন্সেলরদের সাথে মানসিক স্বাস্থ্য ও আত্মহত্যা প্রতিরোধ হেল্পলাইন।' : 'Mental health and suicide prevention helpline with counsellors.',
      hours: '',
    },
    {
      key: 'child_helpline',
      phone: '1098',
      display: '1098',
      kind: 'youth',
      crisis: false,
      name: bn ? 'শিশু হেল্পলাইন (১৮ বছরের কম)' : 'Child Helpline (under 18)',
      description: bn ? 'শিশু ও কিশোরদের জন্য বিনামূল্যে, গোপনীয় সহায়তা।' : 'Free, confidential support for children and young people.',
      hours: bn ? '২৪ ঘণ্টা' : '24/7',
    },
    {
      key: 'dnc_ctc',
      phone: '',
      display: '',
      kind: 'treatment',
      crisis: false,
      url: 'https://ctcdnc.dhaka.gov.bd',
      name: bn ? 'কেন্দ্রীয় মাদকাসক্তি নিরাময় কেন্দ্র, তেজগাঁও' : 'Central Drug Addiction Treatment Centre, Tejgaon',
      description: bn
        ? 'মাদকদ্রব্য নিয়ন্ত্রণ অধিদপ্তরের সরকারি মাদকাসক্তি চিকিৎসা। যোগাযোগের তথ্য ওয়েবসাইটে দেখুন।'
        : 'Government treatment for drug dependence (Department of Narcotics Control). See the website for contact details.',
      hours: '',
    },
  ];
};

export const OFFLINE_HELPLINES: Record<RecoveryLang, Helpline[]> = { en: helplines('en'), bn: helplines('bn') };

export const TOOL_ICONS: Record<ToolKey, IconName> = {
  urge_surf: 'waves',
  breathing: 'weather-windy',
  reasons: 'heart-outline',
  tape_forward: 'fast-forward-outline',
  grounding: 'hand-back-left-outline',
  four_ds: 'numeric-4-circle-outline',
  distract: 'gamepad-variant-outline',
  call_support: 'phone-outline',
  coach: 'robot-happy-outline',
};

export const DEFAULT_TOOL_ORDER: ToolKey[] = ['urge_surf', 'breathing', 'reasons', 'call_support', 'distract', 'tape_forward', 'grounding', 'four_ds', 'coach'];

export const FEELING_KEYS = ['stressed', 'bored', 'lonely', 'sad', 'angry', 'happy', 'tired', 'pressured'] as const;

const TRIGGER_LABELS: Array<[string, string, string]> = [
  ['stress', 'Stress', 'মানসিক চাপ'],
  ['boredom', 'Boredom', 'একঘেয়েমি'],
  ['loneliness', 'Loneliness', 'একাকীত্ব'],
  ['friends', 'Friends / adda', 'বন্ধু / আড্ডা'],
  ['tea_stall', 'Tea stall', 'চায়ের দোকান'],
  ['after_meals', 'After meals', 'খাওয়ার পর'],
  ['late_night', 'Late night', 'গভীর রাত'],
  ['money', 'Money in hand', 'হাতে টাকা'],
  ['family_conflict', 'Family conflict', 'পারিবারিক ঝামেলা'],
  ['work_study', 'Work / exam pressure', 'কাজ / পরীক্ষার চাপ'],
  ['celebration', 'Parties & weddings', 'পার্টি / বিয়েবাড়ি'],
  ['anger', 'Anger', 'রাগ'],
  ['sadness', 'Sadness', 'মন খারাপ'],
  ['cant_sleep', "Can't sleep", 'ঘুম না আসা'],
  ['places', 'Certain places', 'নির্দিষ্ট জায়গা'],
  ['social_media', 'Social media / videos', 'সোশ্যাল মিডিয়া / ভিডিও'],
];

export const OFFLINE_TRIGGERS: Record<RecoveryLang, Array<{ key: string; label: string }>> = {
  en: TRIGGER_LABELS.map(([key, label]) => ({ key, label })),
  bn: TRIGGER_LABELS.map(([key, , label]) => ({ key, label })),
};
