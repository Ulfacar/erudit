import { PublicCalculator } from './PublicCalculator';

export const metadata = {
  title: 'Калькулятор стоимости — Bilim OS',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PublicCalculator />;
}
