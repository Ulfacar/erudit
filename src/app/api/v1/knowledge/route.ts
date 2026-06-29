import { createCrud } from '@/shared/lib/crud';

/**
 * База знаний школы: документы-инструкции (режим работы, приём, оплата...).
 * По ним ассистент ядра отвечает на вопросы любой роли (тул school_knowledge).
 */
export const { GET, POST, DELETE } = createCrud({
  model: 'knowledgeDoc',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'secretary'],
  createFields: ['title', 'category', 'content'],
  injectUserId: 'authorId',
  orderBy: { updatedAt: 'desc' },
  filterableParams: ['category'],
});
