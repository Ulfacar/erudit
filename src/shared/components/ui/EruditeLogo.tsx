export function EruditeLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'sm' ? 18 : size === 'md' ? 24 : 32;
  const capSize = size === 'sm' ? 16 : size === 'md' ? 22 : 28;
  const subSize = size === 'sm' ? 6 : size === 'md' ? 8 : 10;

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
      <span style={{
        fontWeight: 900,
        fontSize,
        letterSpacing: 2,
        fontFamily: "'Inter', sans-serif",
        color: 'var(--mantine-color-text)',
        display: 'inline-flex',
        alignItems: 'flex-end',
      }}>
        ER
        <span style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Graduation cap - sits on top of U */}
          <svg
            width={capSize}
            height={capSize * 0.7}
            viewBox="0 0 32 22"
            fill="none"
            style={{
              position: 'absolute',
              top: -capSize * 0.5,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {/* Main diamond/top of cap */}
            <polygon points="16,0 32,8 16,16 0,8" fill="#E8943A" />
            {/* Bottom band of cap */}
            <path d="M6 10V16C6 16 10 20 16 20C22 20 26 16 26 16V10L16 15L6 10Z" fill="#D4832E" />
            {/* Tassel pole */}
            <rect x="28" y="7" width="1.5" height="9" rx="0.75" fill="#E8943A" />
            {/* Tassel ball */}
            <circle cx="28.75" cy="17" r="1.8" fill="#E8943A" />
          </svg>
          <span style={{ fontSize, fontWeight: 900 }}>U</span>
        </span>
        DITE
      </span>
      <span style={{
        fontSize: subSize,
        letterSpacing: 1.5,
        color: 'var(--mantine-color-dimmed)',
        fontWeight: 400,
        textTransform: 'lowercase',
        marginTop: 1,
      }}>
        сила в знаниях
      </span>
    </span>
  );
}
