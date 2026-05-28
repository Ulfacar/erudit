export function EruditeLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'sm' ? 18 : size === 'md' ? 24 : 32;
  const starSize = size === 'sm' ? 14 : size === 'md' ? 18 : 24;
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
        alignItems: 'center',
        gap: 4,
      }}>
        {/* Star mark */}
        <svg width={starSize} height={starSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 1.5 L14.47 8.6 L21.99 8.76 L15.99 13.3 L18.17 20.49 L12 16.2 L5.83 20.49 L8.01 13.3 L2.01 8.76 L9.53 8.6 Z"
            fill="#E8943A"
          />
        </svg>
        Bilim OS
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
