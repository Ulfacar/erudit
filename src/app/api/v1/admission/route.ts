import { createCrud } from '@/shared/lib/crud';

/**
 * CRM приёмной: лиды воронки (звонок → тест → психолог → директор → договор → зачисление).
 * Замена Google Sheets ассистента директора. Переводы по этапам — PATCH /admission/[id].
 */
export const { GET, POST, DELETE } = createCrud({
  model: 'admissionLead',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['childName', 'targetGrade', 'parentName', 'phone', 'source'],
  intFields: ['targetGrade'],
  injectUserId: 'createdById',
  orderBy: { updatedAt: 'desc' },
  filterableParams: ['stage'],
  branchScope: 'own',
});
