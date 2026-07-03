import type { AssistantScope } from '@/shared/lib/ai/scope';
import { maskText, reidentify, residualPiiRisk } from '@/shared/lib/ai/psy/deidentify';
import { COORDINATOR_ROLES } from '@/shared/lib/psy-safeguarding';

export type SensitiveDomain = 'psych' | 'safeguarding' | 'medical' | 'finance' | 'hr';

type GuardResult = { ok: true } | { ok: false; domain: SensitiveDomain; reply: string };
type GuardAction = 'input_denied' | 'masked' | 'fail_closed';

const DENIED_REPLY = 'У вашей роли нет доступа к этим данным.';
const PHONE_RE = /\+?\d[\d\s\-()]{7,}\d/g;

const DOMAIN_PATTERNS: Record<SensitiveDomain, RegExp[]> = {
  psych: [
    /что\s+(?:психолог|психолог[а-яё]*)\s+(?:записал|написал|отметил)/iu,
    /(?:покажи|дай|открой|найди|пришли).{0,40}(?:психологическ|психолог[а-яё]*).{0,40}(?:запис|замет|кейс|заключ|сесс)/iu,
    /(?:психологическ|психолог[а-яё]*).{0,30}(?:кейс|карта|досье|заключение|заметки|записи|сессии|рекомендации)/iu,
    /(?:диагноз|заключение).{0,30}(?:психолог[а-яё]*|ученик[а-яё]*|реб[её]н[а-яё]*)/iu,
  ],
  safeguarding: [
    /(?:покажи|дай|открой|найди).{0,40}(?:safeguarding|сейфгард|алерт|критическ[а-яё]*\s+сигнал|кейс\s+риска)/iu,
    /(?:насилие|суицид|самоповрежд|буллинг).{0,40}(?:кейс|алерт|запис|отч[её]т|подробности)/iu,
  ],
  medical: [
    /(?:покажи|дай|открой|найди).{0,40}(?:медкарт|медицинск|карта\s+здоровья|анамнез|прививк|аллерги|диагноз|болезн)/iu,
    /(?:что|какой).{0,20}(?:врач|медик).{0,30}(?:записал|написал|отметил|поставил)/iu,
    /(?:диагноз|медкарта|медицинская\s+карта|карта\s+здоровья)\s+(?:ученика|реб[её]нка|студента)/iu,
  ],
  finance: [
    /(?:покажи|дай|открой|найди).{0,40}(?:финансов[а-яё]*\s+сводк|долг|задолженн|сч[её]т|оплат[а-яё]*|плат[её]ж)/iu,
    /(?:кто|список).{0,30}(?:должник|долг|задолженн)/iu,
  ],
  hr: [
    /(?:зарплат|оклад|преми|кадров[а-яё]*\s+дело|трудов[а-яё]*\s+договор|личн[а-яё]*\s+дело).{0,40}(?:сотрудник|учител|педагог|работник|персонал)/iu,
    /(?:покажи|дай|открой|найди).{0,40}(?:зарплат|оклад|кадров[а-яё]*|личн[а-яё]*\s+дело|трудов[а-яё]*\s+договор)/iu,
  ],
};

export function forbiddenDomains(scope: AssistantScope): SensitiveDomain[] {
  const domains: SensitiveDomain[] = [];
  if (!scope.canSeePsych) domains.push('psych');
  if (scope.allowedSpecialistKinds !== 'all' && !scope.allowedSpecialistKinds.includes('medical')) domains.push('medical');
  if (!scope.canSeeFinance) domains.push('finance');
  if (!COORDINATOR_ROLES.includes(scope.role as (typeof COORDINATOR_ROLES)[number]) && scope.role !== 'super_admin') {
    domains.push('safeguarding');
  }
  if (!['hr', 'super_admin'].includes(scope.role)) domains.push('hr');
  return domains;
}

export function guardInput(scope: AssistantScope, message: string): GuardResult {
  const forbidden = new Set(forbiddenDomains(scope));
  for (const domain of Object.keys(DOMAIN_PATTERNS) as SensitiveDomain[]) {
    if (!forbidden.has(domain)) continue;
    if (DOMAIN_PATTERNS[domain].some((pattern) => pattern.test(message))) {
      return { ok: false, domain, reply: DENIED_REPLY };
    }
  }
  return { ok: true };
}

export function createMaskSession(): {
  maskOut: (text: string) => string;
  unmaskArgs: (jsonStr: string) => string;
  reidentifyReply: (text: string) => string;
  maskedCount: () => number;
} {
  const map: Record<string, string> = {};
  let nextPerson = 1;
  let nextPhone = 1;
  let totalMasked = 0;

  const remember = (m: Record<string, string>) => {
    for (const [marker, value] of Object.entries(m)) {
      if (!map[marker]) map[marker] = value;
    }
  };

  const maskPhones = (text: string): string =>
    text.replace(PHONE_RE, (match) => {
      if (match.replace(/\D/g, '').length < 9) return match;
      const marker = `[ТЕЛЕФОН_${nextPhone++}]`;
      map[marker] = match;
      totalMasked += 1;
      return marker;
    });

  return {
    maskOut(text: string): string {
      const deid = maskText(text, [], { startAt: nextPerson });
      remember(deid.map);
      nextPerson += deid.count;
      totalMasked += deid.count;
      return maskPhones(deid.masked);
    },
    unmaskArgs(jsonStr: string): string {
      return reidentify(jsonStr, map);
    },
    reidentifyReply(text: string): string {
      return reidentify(text, map);
    },
    maskedCount(): number {
      return totalMasked;
    },
  };
}

export function aiStrictPrivacy(): boolean {
  const v = (process.env.AI_STRICT_PRIVACY ?? '').trim().toLowerCase();
  return !(v === 'off' || v === '0' || v === 'false');
}

export function signalTypes(signals: string[]): string[] {
  return [...new Set(signals.map((signal) => signal.split('(')[0].trim()).filter(Boolean))];
}

export function logGuard(event: {
  role: AssistantScope['role'];
  action: GuardAction;
  domain?: SensitiveDomain;
  maskedCount?: number;
  signalTypes?: string[];
}): void {
  console.info('[privacy-guard]', {
    role: event.role,
    action: event.action,
    ...(event.domain ? { domain: event.domain } : {}),
    maskedCount: event.maskedCount ?? 0,
    signalTypes: event.signalTypes ?? [],
  });
}

export function residualSignalTypes(text: string): string[] {
  return signalTypes(residualPiiRisk(text).signals);
}
