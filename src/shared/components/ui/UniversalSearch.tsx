'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconUser, IconChalkboard } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

/* ── Color palette for class badges ── */
const CLASS_COLORS: Record<string, string> = {
  '1': 'cyan', '2': 'teal', '3': 'green', '4': 'lime',
  '5': 'blue', '6': 'indigo', '7': 'violet', '8': 'grape',
  '9': 'pink', '10': 'orange', '11': 'red', '12': 'yellow',
};

const NAME_COLORS = ['pink', 'orange', 'green', 'blue', 'violet', 'cyan', 'indigo', 'red'];

function getClassColor(classLabel: string | null) {
  if (!classLabel) return 'gray';
  const grade = classLabel.replace(/[^0-9]/g, '');
  return CLASS_COLORS[grade] || 'gray';
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  photo?: string | null;
  type: 'student' | 'teacher';
  classLabel?: string | null;
  curator?: string | null;
  position?: string | null;
  subjects?: string[];
  curatorOf?: string[];
}

export function UniversalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [results, setResults] = useState<{ students: SearchResult[]; teachers: SearchResult[] }>({
    students: [],
    teachers: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({ students: [], teachers: [] });
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setResults(json.data);
        setIsOpen(true);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    if (item.type === 'student') {
      router.push(`/students/${item.id}`);
    } else {
      router.push(`/teachers/${item.id}`);
    }
  };

  const fullName = (r: SearchResult) =>
    [r.lastName, r.firstName, r.middleName].filter(Boolean).join(' ');

  const hasResults = results.students.length > 0 || results.teachers.length > 0;

  return (
    <Box ref={containerRef} pos="relative" w={300}>
      <TextInput
        placeholder="Поиск"
        leftSection={<IconSearch size={16} />}
        rightSection={isLoading ? <Loader size={14} /> : undefined}
        size="xs"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onFocus={() => {
          if (hasResults) setIsOpen(true);
        }}
      />

      {isOpen && hasResults && (
        <Paper
          shadow="lg"
          radius="md"
          withBorder
          pos="absolute"
          top={36}
          left={0}
          right={0}
          style={{ zIndex: 1000, maxHeight: 400, overflowY: 'auto' }}
          p="xs"
        >
          <Stack gap={4}>
            {results.students.length > 0 && (
              <>
                <Text size="xs" c="dimmed" fw={600} px={8} pt={4}>
                  Ученики
                </Text>
                {results.students.map((s, idx) => (
                  <Box
                    key={s.id}
                    px={8}
                    py={6}
                    style={{
                      borderRadius: 'var(--mantine-radius-sm)',
                      cursor: 'pointer',
                    }}
                    className="search-result-item"
                    onClick={() => handleSelect(s)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--mantine-color-dark-5)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <Group gap={8} wrap="nowrap">
                      {s.classLabel && (
                        <Badge
                          size="sm"
                          variant="filled"
                          color={getClassColor(s.classLabel)}
                          fw={700}
                          style={{ minWidth: 40, textTransform: 'none' }}
                        >
                          {s.classLabel} кл.
                        </Badge>
                      )}
                      <Badge
                        size="sm"
                        variant="light"
                        color={NAME_COLORS[idx % NAME_COLORS.length]}
                        style={{ textTransform: 'none' }}
                      >
                        {fullName(s)}
                      </Badge>
                      {s.curator && (
                        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                          Куратор: {s.curator}
                        </Text>
                      )}
                    </Group>
                  </Box>
                ))}
              </>
            )}

            {results.teachers.length > 0 && (
              <>
                <Text size="xs" c="dimmed" fw={600} px={8} pt={4}>
                  Педагоги
                </Text>
                {results.teachers.map((t, idx) => (
                  <Box
                    key={t.id}
                    px={8}
                    py={6}
                    style={{
                      borderRadius: 'var(--mantine-radius-sm)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleSelect(t)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--mantine-color-dark-5)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <Group gap={8} wrap="nowrap">
                      {t.curatorOf && t.curatorOf.length > 0 && (
                        <Badge
                          size="sm"
                          variant="filled"
                          color={getClassColor(t.curatorOf[0])}
                          fw={700}
                          style={{ minWidth: 40, textTransform: 'none' }}
                        >
                          {t.curatorOf[0]} кл.
                        </Badge>
                      )}
                      <Badge
                        size="sm"
                        variant="light"
                        color={NAME_COLORS[(idx + 3) % NAME_COLORS.length]}
                        style={{ textTransform: 'none' }}
                      >
                        {fullName(t)}
                      </Badge>
                      <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                        {t.position || 'Педагог'}
                      </Text>
                    </Group>
                  </Box>
                ))}
              </>
            )}
          </Stack>
        </Paper>
      )}

      {isOpen && !hasResults && debouncedQuery.length >= 2 && !isLoading && (
        <Paper
          shadow="lg"
          radius="md"
          withBorder
          pos="absolute"
          top={36}
          left={0}
          right={0}
          style={{ zIndex: 1000 }}
          p="md"
        >
          <Text size="sm" c="dimmed" ta="center">
            Ничего не найдено
          </Text>
        </Paper>
      )}
    </Box>
  );
}
