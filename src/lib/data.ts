export type EventMode = 'Open' | 'Verified';

export type DemoEvent = {
  id: number;
  title: string;
  category: string;
  date: string;
  venue: string;
  price: string;
  sold: number;
  capacity: number;
  mode: EventMode;
  accent: string;
  image: string;
  description: string;
};

export const demoEvents: DemoEvent[] = [
  {
    id: 1,
    title: 'Neon Seoul Live',
    category: 'MUSIC',
    date: 'AUG 14 · 20:00',
    venue: 'Nodeul Island, Seoul',
    price: '0.004 ETH',
    sold: 1840,
    capacity: 2000,
    mode: 'Verified',
    accent: 'violet',
    image: 'neon',
    description: 'A one-night electronic live set with wallet-bound entry and original-price returns.',
  },
  {
    id: 2,
    title: 'GIWA Builders Night',
    category: 'COMMUNITY',
    date: 'AUG 22 · 18:30',
    venue: 'Gangnam, Seoul',
    price: 'FREE',
    sold: 312,
    capacity: 400,
    mode: 'Open',
    accent: 'lime',
    image: 'builders',
    description: 'Meet the teams building simple, useful onchain experiences for the next wave of users.',
  },
  {
    id: 3,
    title: 'Arena Zero Finals',
    category: 'ESPORTS',
    date: 'SEP 06 · 16:00',
    venue: 'Inspire Arena, Incheon',
    price: '0.006 ETH',
    sold: 5000,
    capacity: 5000,
    mode: 'Verified',
    accent: 'coral',
    image: 'arena',
    description: 'A sold-out championship where returned seats move directly to the verified waitlist.',
  },
];
