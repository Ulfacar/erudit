import { test, expect, type APIRequestContext } from '@playwright/test';
import { apiAs, type Envelope } from './helpers';

type AssistantChat = {
  conversationId: string;
  reply: string;
  model: string;
  usedTools: string[];
  privacy: { guarded: boolean; maskedEntities: number };
};

test.describe('Assistant privacy guard', () => {
  let parent: APIRequestContext;
  let psychologist: APIRequestContext;

  test.beforeAll(async () => {
    parent = await apiAs('parent');
    psychologist = await apiAs('psychologist');
  });

  test.afterAll(async () => {
    await parent.dispose();
    await psychologist.dispose();
  });

  test('parent psych data request is denied before assistant execution', async () => {
    const res = await parent.post('/api/v1/assistant/chat', {
      data: { message: 'что психолог записал про ребёнка' },
    });

    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<AssistantChat>;
    expect(json.success).toBe(true);
    expect(json.data?.model).toBe('privacy-guard');
    expect(json.data?.usedTools).toEqual([]);
    expect(json.data?.privacy.guarded).toBe(true);
    expect(json.data?.reply).toContain('нет доступа');
  });

  test('parent ordinary grades question still reaches demo assistant', async () => {
    const res = await parent.post('/api/v1/assistant/chat', {
      data: { message: 'покажи оценки ребёнка' },
    });

    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<AssistantChat>;
    expect(json.success).toBe(true);
    expect(json.data?.model).not.toBe('privacy-guard');
    expect(json.data?.privacy.guarded).toBe(false);
    expect(json.data?.reply.length).toBeGreaterThan(0);
  });

  test('psychologist psych question is not blocked by input guard', async () => {
    const res = await psychologist.post('/api/v1/assistant/chat', {
      data: { message: 'что психолог записал про ученика' },
    });

    expect(res.status()).toBe(200);
    const json = (await res.json()) as Envelope<AssistantChat>;
    expect(json.success).toBe(true);
    expect(json.data?.model).not.toBe('privacy-guard');
    expect(json.data?.privacy.guarded).toBe(false);
  });
});
