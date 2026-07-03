export const USD_RATE = 89;
export const PRICING_VERSION = 'emir-v1.1';

export type SchoolSizeId = 'up_to_300' | 'from_300_to_700' | 'above_700';

export const SCHOOL_SIZES: { id: SchoolSizeId; label: string; unitPrice: number }[] = [
  { id: 'up_to_300', label: 'До 300 учеников', unitPrice: 30000 },
  { id: 'from_300_to_700', label: '300–700 учеников', unitPrice: 45000 },
  { id: 'above_700', label: 'Более 700 учеников', unitPrice: 60000 },
];

export const DEFAULT_SCHOOL_SIZE: SchoolSizeId = 'from_300_to_700';

export interface TariffModule {
  id: string;
  label: string;
  description: string;
  weight: number;
  required?: boolean;
}

export const CORE_MODULE: TariffModule = {
  id: 'core',
  label: 'Ядро платформы',
  description: 'Журнал, расписание, дневник, роли, уведомления, отчёты',
  weight: 4,
  required: true,
};

export const ADDON_MODULES: TariffModule[] = [
  {
    id: 'admissions',
    label: 'Приёмка и удержание',
    description: 'CRM поступления, колл-центр, воронка, договоры',
    weight: 2,
    required: true,
  },
  {
    id: 'finance',
    label: 'Финансы и оплаты',
    description: 'Платежи, задолженности, пени, финдашборд',
    weight: 2,
    required: true,
  },
  {
    id: 'psych',
    label: 'Психологическая служба',
    description: 'Кейсы, сопровождение, безопасность учеников',
    weight: 2,
  },
  {
    id: 'college',
    label: 'Поступление в вузы',
    description: 'Консалтинг и трек подготовки к колледжу/вузу',
    weight: 2,
  },
  {
    id: 'content',
    label: 'Учебный контент',
    description: 'КТП, планы уроков, тесты, ДЗ, база знаний',
    weight: 1.5,
  },
  {
    id: 'hr',
    label: 'HR и кадры',
    description: 'Онбординг, анкеты, часы, отпуска, замены',
    weight: 1,
  },
  {
    id: 'library',
    label: 'Библиотека',
    description: 'Фонд, выдача, сканирование',
    weight: 1,
  },
  {
    id: 'ops',
    label: 'Хозяйство и операции',
    description: 'Закупки, питание, инвентарь, бюро находок',
    weight: 1,
  },
  {
    id: 'extra',
    label: 'Внеучебная жизнь',
    description: 'Мероприятия, кружки, экскурсии, достижения',
    weight: 1,
  },
];

export const REQUIRED_ADDON_IDS = ADDON_MODULES.filter((module) => module.required).map((module) => module.id);

export type PresetId = 'base' | 'medium' | 'max' | 'core_solo';

export interface TariffPreset {
  id: PresetId;
  label: string;
  description: string;
  addonIds: string[];
  recommended?: boolean;
  hidden?: boolean;
}

export const PRESETS: TariffPreset[] = [
  {
    id: 'base',
    label: 'База',
    description: 'Ядро + приёмка + финансы — административный минимум',
    addonIds: ['admissions', 'finance'],
  },
  {
    id: 'medium',
    label: 'Медиум',
    description: 'База + психслужба, учебный контент и HR',
    addonIds: ['admissions', 'finance', 'psych', 'content', 'hr'],
    recommended: true,
  },
  {
    id: 'max',
    label: 'Максимум',
    description: 'Все модули платформы',
    addonIds: ADDON_MODULES.map((module) => module.id),
  },
  {
    id: 'core_solo',
    label: 'Ядро-соло',
    description: 'Только ядро (не публикуется)',
    addonIds: [],
    hidden: true,
  },
];

export const DEFAULT_PRESET_ID: PresetId = 'medium';
export const YEAR_ONE_MULTIPLIER = 1.2;
export const MONTHLY_MULTIPLIER = 1.15;

export type PricingMode = 'preset' | 'custom';

export interface TariffQuote {
  weightTotal: number;
  unitPrice: number;
  annualLicence: number;
  yearOne: number;
  monthly: number;
}

const addonIdSet = new Set(ADDON_MODULES.map((module) => module.id));

function resolveAddons(mode: PricingMode, presetId?: PresetId, addonIds?: string[]) {
  if (mode === 'preset') {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) throw new Error('UNKNOWN_PRESET');
    return preset.addonIds;
  }

  const filtered = (addonIds ?? []).filter((id) => addonIdSet.has(id));
  return [...new Set([...REQUIRED_ADDON_IDS, ...filtered])];
}

export function computeTariff({
  schoolSize,
  mode,
  presetId,
  addonIds,
}: {
  schoolSize: SchoolSizeId;
  mode: PricingMode;
  presetId?: PresetId;
  addonIds?: string[];
}): TariffQuote {
  const size = SCHOOL_SIZES.find((item) => item.id === schoolSize);
  if (!size) throw new Error('UNKNOWN_SIZE');

  const addons = resolveAddons(mode, presetId, addonIds);
  const weightTotal =
    CORE_MODULE.weight +
    addons.reduce((sum, id) => sum + (ADDON_MODULES.find((module) => module.id === id)?.weight ?? 0), 0);
  const annualLicence = weightTotal * size.unitPrice;

  return {
    weightTotal,
    unitPrice: size.unitPrice,
    annualLicence,
    yearOne: Math.round(annualLicence * YEAR_ONE_MULTIPLIER),
    monthly: Math.round(((annualLicence / 12) * MONTHLY_MULTIPLIER) / 1000) * 1000,
  };
}

export function resolveModuleIds(mode: PricingMode, presetId?: PresetId, addonIds?: string[]) {
  const addons = resolveAddons(mode, presetId, addonIds);
  const addonSet = new Set(addons);
  return ['core', ...ADDON_MODULES.filter((module) => addonSet.has(module.id)).map((module) => module.id)];
}

export function getModuleById(id: string) {
  if (id === CORE_MODULE.id) return CORE_MODULE;
  return ADDON_MODULES.find((module) => module.id === id);
}
