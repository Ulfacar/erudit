'use client';

import { useState } from 'react';
import type { Role } from '@prisma/client';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  NavLink,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconSearch } from '@tabler/icons-react';
import { BilimosLogo } from '@/shared/components/ui/BilimosLogo';
import { ALL_ROLES, ROLE_LABELS } from '@/shared/constants/roles';
import {
  DOC_ARTICLES,
  DOC_MODULES,
  ROLE_GUIDES,
  articlesByModule,
  articlesForRole,
  getArticle,
  searchArticles,
  type DocArticle,
} from '@/shared/lib/docs/content';

type DocsAxis = 'role' | 'module';

function DocsHeader() {
  return (
    <Group justify="space-between" align="center" gap="md">
      <Group gap="md" align="center">
        <BilimosLogo size="md" />
        <Title order={3}>Документация</Title>
      </Group>
      <Anchor href="/">На главную</Anchor>
    </Group>
  );
}

function ArticleList({ articles, intro, onOpen }: { articles: DocArticle[]; intro?: string; onOpen: (id: string) => void }) {
  return (
    <Stack gap="md">
      {intro && (
        <Text c="dimmed" size="sm">
          {intro}
        </Text>
      )}
      {articles.map((article) => (
        <Card
          key={article.id}
          withBorder
          radius="lg"
          p="lg"
          onClick={() => onOpen(article.id)}
          style={{ cursor: 'pointer' }}
        >
          <Stack gap={6}>
            <Title order={4}>{article.title}</Title>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {article.summary}
            </Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function SearchResults({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const results = searchArticles(query);

  if (!results.length) {
    return <Text c="dimmed">Ничего не найдено</Text>;
  }

  return <ArticleList articles={results} onOpen={onOpen} />;
}

function ArticleView({ article, onBack, onOpen }: { article: DocArticle; onBack: () => void; onOpen: (id: string) => void }) {
  const mod = DOC_MODULES.find((item) => item.id === article.moduleId);
  const related = article.related?.map(getArticle).filter((item): item is DocArticle => Boolean(item)) ?? [];

  return (
    <Stack gap="lg">
      <Button variant="subtle" color="bilimosBlue" leftSection={<IconArrowLeft size={18} />} onClick={onBack}>
        Назад к списку
      </Button>
      <Stack gap="xs">
        {mod && (
          <Badge variant="light" color="bilimosBlue">
            {mod.title}
          </Badge>
        )}
        <Title order={2}>{article.title}</Title>
        <Text c="dimmed">{article.summary}</Text>
      </Stack>

      <Stack gap="md">
        {article.steps.map((step, index) => (
          <Group key={`${article.id}-${index}`} align="flex-start" wrap="nowrap" gap="md">
            <ThemeIcon radius="xl" color="bilimosBlue" variant="light" size={32}>
              {index + 1}
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text>{step.text}</Text>
              {step.img && (
                <img
                  src={step.img}
                  alt={`Шаг ${index + 1}: ${article.title}`}
                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--mantine-color-gray-3)' }}
                />
              )}
            </Box>
          </Group>
        ))}
      </Stack>

      {related.length > 0 && (
        <>
          <Divider />
          <Stack gap="xs">
            <Title order={4}>Смотрите также</Title>
            {related.map((item) => (
              <Anchor
                key={item.id}
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(item.id);
                }}
              >
                {item.title}
              </Anchor>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

function RolePanel({ role, onOpen }: { role: Role; onOpen: (id: string) => void }) {
  const guide = ROLE_GUIDES.find((item) => item.role === role);

  if (!guide) {
    return (
      <Paper withBorder radius="lg" p="lg">
        <Text c="dimmed">Гайд для роли «{ROLE_LABELS[role]}» готовится</Text>
      </Paper>
    );
  }

  return <ArticleList articles={articlesForRole(role)} intro={guide.intro} onOpen={onOpen} />;
}

function Sidebar({
  axis,
  selectedRole,
  selectedModule,
  query,
  onAxisChange,
  onRoleSelect,
  onModuleSelect,
  onQueryChange,
}: {
  axis: DocsAxis;
  selectedRole: Role | null;
  selectedModule: string | null;
  query: string;
  onAxisChange: (axis: DocsAxis) => void;
  onRoleSelect: (role: Role) => void;
  onModuleSelect: (moduleId: string) => void;
  onQueryChange: (query: string) => void;
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="md">
        <TextInput
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          placeholder="Поиск по документации"
        />
        <SegmentedControl
          fullWidth
          value={axis}
          onChange={(value) => onAxisChange(value as DocsAxis)}
          data={[
            { value: 'role', label: 'По роли' },
            { value: 'module', label: 'По модулю' },
          ]}
        />

        <ScrollArea.Autosize mah="60vh" type="auto">
          <Stack gap={4}>
            {axis === 'role'
              ? ALL_ROLES.map((role) => {
                  const guide = ROLE_GUIDES.find((item) => item.role === role);
                  return (
                    <NavLink
                      key={role}
                      label={ROLE_LABELS[role]}
                      active={selectedRole === role}
                      onClick={() => onRoleSelect(role)}
                      rightSection={
                        guide ? (
                          <Badge size="xs" color="bilimosBlue" variant="light">
                            {guide.articleIds.length}
                          </Badge>
                        ) : undefined
                      }
                    />
                  );
                })
              : DOC_MODULES.map((mod) => (
                  <NavLink
                    key={mod.id}
                    label={mod.title}
                    leftSection={<Text span>{mod.icon}</Text>}
                    active={selectedModule === mod.id}
                    onClick={() => onModuleSelect(mod.id)}
                  />
                ))}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
    </Paper>
  );
}

export function PublicDocs() {
  const [axis, setAxis] = useState<DocsAxis>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const article = articleId ? getArticle(articleId) : undefined;

  function openArticleFromSearch(id: string) {
    setArticleId(id);
    setQuery('');
  }

  function changeAxis(nextAxis: DocsAxis) {
    setAxis(nextAxis);
    setArticleId(null);
    setQuery('');
  }

  function renderContent() {
    if (query.trim()) {
      return <SearchResults query={query} onOpen={openArticleFromSearch} />;
    }

    if (article) {
      return <ArticleView article={article} onBack={() => setArticleId(null)} onOpen={setArticleId} />;
    }

    if (axis === 'role' && selectedRole) {
      return <RolePanel role={selectedRole} onOpen={setArticleId} />;
    }

    if (axis === 'module' && selectedModule) {
      return <ArticleList articles={articlesByModule(selectedModule)} onOpen={setArticleId} />;
    }

    return (
      <Paper withBorder radius="lg" p="lg">
        <Text c="dimmed">Выберите роль или модуль слева</Text>
      </Paper>
    );
  }

  return (
    <Box bg="gray.0" mih="100vh">
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <DocsHeader />
          <Grid gutter="lg" align="flex-start">
            <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
              <Sidebar
                axis={axis}
                selectedRole={selectedRole}
                selectedModule={selectedModule}
                query={query}
                onAxisChange={changeAxis}
                onRoleSelect={(role) => {
                  setSelectedRole(role);
                  setArticleId(null);
                  setQuery('');
                }}
                onModuleSelect={(moduleId) => {
                  setSelectedModule(moduleId);
                  setArticleId(null);
                  setQuery('');
                }}
                onQueryChange={setQuery}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
              <Paper withBorder radius="lg" p="xl" bg="white">
                {renderContent()}
              </Paper>
            </Grid.Col>
          </Grid>
          <Text size="xs" c="dimmed">
            Статей в справочном центре: {DOC_ARTICLES.length}
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
