// Langues proposées par le sélecteur : [code MyMemory, nom dans la langue elle-même].
// La langue source du site est le français : choisir « fr » remet les textes d'origine.
export const SOURCE_LANG = 'fr';

export const LANGUAGES = [
  ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'],
  ['pt-PT', 'Português (Portugal)'], ['pt-BR', 'Português (Brasil)'], ['nl', 'Nederlands'], ['ca', 'Català'],
  ['gl', 'Galego'], ['eu', 'Euskara'], ['pl', 'Polski'], ['cs', 'Čeština'], ['sk', 'Slovenčina'], ['hu', 'Magyar'],
  ['ro', 'Română'], ['bg', 'Български'], ['sr', 'Српски'], ['hr', 'Hrvatski'], ['bs', 'Bosanski'], ['sl', 'Slovenščina'],
  ['mk', 'Македонски'], ['sq', 'Shqip'], ['el', 'Ελληνικά'], ['tr', 'Türkçe'], ['ru', 'Русский'], ['uk', 'Українська'],
  ['be', 'Беларуская'], ['lt', 'Lietuvių'], ['lv', 'Latviešu'], ['et', 'Eesti'], ['fi', 'Suomi'], ['sv', 'Svenska'],
  ['no', 'Norsk'], ['da', 'Dansk'], ['is', 'Íslenska'], ['ga', 'Gaeilge'], ['cy', 'Cymraeg'], ['mt', 'Malti'],
  ['hy', 'Հայերեն'], ['ka', 'ქართული'], ['az', 'Azərbaycanca'], ['kk', 'Қазақша'], ['uz', 'Oʻzbekcha'],
  ['ar', 'العربية'], ['he', 'עברית'], ['fa', 'فارسی'], ['ur', 'اردو'], ['ku', 'Kurdî'],
  ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['pa', 'ਪੰਜਾਬੀ'], ['gu', 'ગુજરાતી'], ['mr', 'मराठी'], ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'], ['ml', 'മലയാളം'], ['ne', 'नेपाली'], ['si', 'සිංහල'],
  ['th', 'ไทย'], ['lo', 'ລາວ'], ['km', 'ខ្មែរ'], ['my', 'မြန်မာ'], ['vi', 'Tiếng Việt'], ['id', 'Bahasa Indonesia'],
  ['ms', 'Bahasa Melayu'], ['tl', 'Filipino'], ['ja', '日本語'], ['ko', '한국어'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
  ['mn', 'Монгол'], ['sw', 'Kiswahili'], ['af', 'Afrikaans'], ['am', 'አማርኛ'], ['so', 'Soomaali'], ['zu', 'isiZulu'],
  ['ha', 'Hausa'], ['yo', 'Yorùbá'], ['la', 'Latina'],
];

const CODES = new Map(LANGUAGES.map(([c]) => [c.toLowerCase(), c]));

// Langues écrites de droite à gauche.
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ku']);
export const isRtl = (code) => RTL.has(String(code).split('-')[0].toLowerCase());

// matchLanguage : « en-US » -> « en », « pt-BR » -> « pt-BR », « zh-HK » -> « zh-TW », inconnu -> null.
export function matchLanguage(tag) {
  if (!tag) return null;
  const t = String(tag).replace('_', '-').toLowerCase();
  if (CODES.has(t)) return CODES.get(t);
  const [base, region] = t.split('-');
  if (base === 'zh') return ['tw', 'hk', 'mo'].includes(region) || t.includes('hant') ? 'zh-TW' : 'zh-CN';
  if (base === 'pt') return 'pt-PT';
  if (base === 'nb' || base === 'nn') return 'no';
  if (base === 'fil') return 'tl';
  return CODES.get(base) || null;
}

// detectLanguage : choix mémorisé, sinon première langue du navigateur reconnue, sinon le français.
export function detectLanguage(stored, navigatorLanguages) {
  const s = matchLanguage(stored);
  if (s) return s;
  for (const tag of navigatorLanguages || []) {
    const m = matchLanguage(tag);
    if (m) return m;
  }
  return SOURCE_LANG;
}
