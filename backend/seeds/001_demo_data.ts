import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

// Fixed, known identifiers so re-running this seed is idempotent. It only ever
// deletes the accounts listed here, and their events/rsvps go with them through
// the FK cascades. Anything a reviewer created by hand is left alone.
const DEMO_PASSWORD = 'Demo1234!';

const USERS = [
  { key: 'ada', name: 'Ada Lovelace', email: 'demo@evently.dev', verified: true },
  { key: 'grace', name: 'Grace Hopper', email: 'demo2@evently.dev', verified: true },
  { key: 'priya', name: 'Priya Sharma', email: 'priya@evently.dev', verified: true },
  { key: 'marcus', name: 'Marcus Bell', email: 'marcus@evently.dev', verified: true },
  { key: 'yuki', name: 'Yuki Tanaka', email: 'yuki@evently.dev', verified: true },
  { key: 'sofia', name: 'Sofia Ramos', email: 'sofia@evently.dev', verified: true },
  { key: 'omar', name: 'Omar Haddad', email: 'omar@evently.dev', verified: true },
  // left unverified on purpose so the "verify your email" banner is visible
  { key: 'tom', name: 'Tom Fletcher', email: 'unverified@evently.dev', verified: false },
];

type Visibility = 'public' | 'private';

interface SeedEvent {
  creator: string;
  title: string;
  description?: string;
  /** days from now; negative is in the past */
  startsInDays: number;
  /** event length in hours */
  hours: number;
  location: string;
  visibility: Visibility;
  tags: string[];
  /** how long ago the row was created, so the creation-time sort is meaningful */
  createdDaysAgo: number;
  going?: string[];
  maybe?: string[];
  notGoing?: string[];
}

const EVENTS: SeedEvent[] = [
  // ---------- upcoming ----------
  {
    creator: 'ada',
    title: 'Future of Work Conference',
    description:
      'A day of talks on remote-first teams, async collaboration, and the tools reshaping how we work.',
    startsInDays: 3,
    hours: 8,
    location: 'Austin Convention Center, Austin, TX',
    visibility: 'public',
    tags: ['conference', 'leadership'],
    createdDaysAgo: 40,
    going: ['grace', 'priya', 'marcus', 'yuki', 'sofia', 'omar'],
    maybe: ['tom'],
  },
  {
    creator: 'yuki',
    title: 'Morning Trail Run',
    description: 'Easy 8k loop at conversational pace. All levels welcome, we regroup at every gate.',
    startsInDays: 1,
    hours: 2,
    location: 'Richmond Park, London',
    visibility: 'public',
    tags: ['sports', 'community'],
    createdDaysAgo: 12,
    going: ['ada', 'grace', 'priya', 'marcus', 'sofia', 'omar', 'tom'],
  },
  {
    creator: 'priya',
    title: 'Hackathon: Build in a Weekend',
    description: 'Two days, any stack, one demo at the end. Teams of up to four.',
    startsInDays: 21,
    hours: 48,
    location: 'Warehouse 9, Manchester',
    visibility: 'public',
    tags: ['hackathon', 'engineering', 'community'],
    createdDaysAgo: 55,
    going: ['ada', 'grace', 'marcus', 'yuki', 'sofia', 'omar'],
    notGoing: ['tom'],
  },
  {
    creator: 'priya',
    title: 'Kubernetes Deep Dive',
    description:
      'Scheduling, resource limits and what actually happens when a pod gets evicted. Bring a laptop.',
    startsInDays: 9,
    hours: 3,
    location: 'Lisbon Tech Hub, Lisbon',
    visibility: 'public',
    tags: ['engineering', 'training'],
    createdDaysAgo: 30,
    going: ['ada', 'grace', 'marcus', 'omar', 'tom'],
    maybe: ['sofia'],
  },
  {
    creator: 'priya',
    title: 'Women in Engineering Panel',
    description: 'Five engineers on career switches, staying technical, and saying no to hero work.',
    startsInDays: 19,
    hours: 2,
    location: 'Barbican Centre, London',
    visibility: 'public',
    tags: ['conference', 'community'],
    createdDaysAgo: 22,
    going: ['ada', 'grace', 'yuki', 'sofia', 'omar'],
  },
  {
    creator: 'ada',
    title: 'Design Systems Workshop',
    description: 'Hands-on session building a token-based component library from scratch.',
    startsInDays: 5,
    hours: 2,
    location: 'Remote',
    visibility: 'public',
    tags: ['design', 'workshop'],
    createdDaysAgo: 18,
    going: ['grace', 'sofia', 'omar', 'yuki'],
    maybe: ['priya'],
  },
  {
    creator: 'sofia',
    title: 'Street Food Festival',
    description: 'Thirty stalls, three live sets, one very long queue for the dumplings.',
    startsInDays: 14,
    hours: 9,
    location: 'Camden Market, London',
    visibility: 'public',
    tags: ['food', 'community'],
    createdDaysAgo: 8,
    going: ['ada', 'marcus', 'yuki', 'tom'],
    maybe: ['grace', 'omar'],
  },
  {
    creator: 'omar',
    title: 'Database Indexing Masterclass',
    description:
      'Composite indexes, covering indexes, and reading an EXPLAIN plan without guessing. The query planner is less mysterious than it looks.',
    startsInDays: 18,
    hours: 4,
    location: 'Remote',
    visibility: 'public',
    tags: ['engineering', 'training'],
    createdDaysAgo: 35,
    going: ['ada', 'priya', 'grace', 'yuki'],
  },
  {
    creator: 'grace',
    title: 'Open Source Office Hours',
    description: 'Drop-in Q&A for anyone contributing to the project. No question too small.',
    startsInDays: 2,
    hours: 1,
    location: 'Remote',
    visibility: 'public',
    tags: ['community', 'engineering'],
    createdDaysAgo: 5,
    going: ['ada', 'priya', 'tom'],
    maybe: ['marcus'],
  },
  {
    creator: 'grace',
    title: 'Intro to TypeScript Generics',
    description: 'From `Array<T>` to conditional types, with the bits people usually skip.',
    startsInDays: 4,
    hours: 2,
    location: 'Remote',
    visibility: 'public',
    tags: ['training', 'engineering'],
    createdDaysAgo: 60,
    going: ['marcus', 'sofia', 'tom'],
  },
  {
    creator: 'priya',
    title: 'Rust for JS Developers',
    description: 'Ownership and borrowing explained for people who already think in closures.',
    startsInDays: 23,
    hours: 3,
    location: 'Manchester Tech Hub, Manchester',
    visibility: 'public',
    tags: ['training', 'engineering'],
    createdDaysAgo: 3,
    going: ['ada', 'omar', 'yuki'],
  },
  {
    creator: 'sofia',
    title: 'Pitch Practice Evening',
    description: 'Five minutes each, honest feedback, no slides allowed for the first round.',
    startsInDays: 16,
    hours: 2,
    location: 'Impact Hub, Lisbon',
    visibility: 'public',
    tags: ['networking', 'leadership'],
    createdDaysAgo: 27,
    going: ['grace', 'marcus', 'priya'],
    notGoing: ['yuki'],
  },
  {
    creator: 'yuki',
    title: 'Sunrise Yoga',
    startsInDays: 2,
    hours: 1,
    location: 'Brighton Beach, Brighton',
    visibility: 'public',
    tags: ['sports'],
    createdDaysAgo: 15,
    going: ['sofia', 'grace', 'tom'],
  },
  {
    creator: 'marcus',
    title: 'Board Game Social',
    description: 'Heavy euros on one table, party games on the other. Snacks provided.',
    startsInDays: 10,
    hours: 4,
    location: 'The Old Library, Bristol',
    visibility: 'public',
    tags: ['community', 'networking'],
    createdDaysAgo: 44,
    going: ['yuki', 'tom'],
    maybe: ['sofia', 'grace'],
  },
  {
    creator: 'marcus',
    title: 'Indie Music Night',
    description: 'Four local bands, doors at seven.',
    startsInDays: 11,
    hours: 4,
    location: 'The Bullring, Birmingham',
    visibility: 'public',
    tags: ['music'],
    createdDaysAgo: 9,
    going: ['sofia', 'omar'],
  },
  {
    creator: 'marcus',
    title: 'Open Mic Night',
    description: 'Sign-up sheet opens at six. Five minutes each, any format.',
    startsInDays: 26,
    hours: 3,
    location: 'The Fleece, Bristol',
    visibility: 'public',
    tags: ['music', 'community'],
    createdDaysAgo: 2,
    going: ['yuki'],
  },
  {
    creator: 'grace',
    title: 'Docs Sprint',
    description: 'One afternoon spent entirely on the getting-started guide nobody has updated.',
    startsInDays: 12,
    hours: 5,
    location: 'Remote',
    visibility: 'public',
    tags: ['community', 'workshop'],
    createdDaysAgo: 33,
    going: ['priya', 'omar'],
  },
  {
    creator: 'grace',
    title: 'Async Standup Experiment',
    description: 'Trialling written standups for a month and comparing notes on what broke.',
    startsInDays: 17,
    hours: 1,
    location: 'Remote',
    visibility: 'public',
    tags: ['leadership', 'engineering'],
    createdDaysAgo: 20,
    going: ['ada', 'priya'],
  },
  {
    creator: 'omar',
    title: 'Accessibility Audit Clinic',
    description: 'Bring a page, leave with a prioritised list of fixes and a keyboard-only demo.',
    startsInDays: 6,
    hours: 3,
    location: 'Remote',
    visibility: 'public',
    tags: ['design', 'training'],
    createdDaysAgo: 50,
    going: ['sofia'],
    maybe: ['ada', 'grace'],
  },
  {
    creator: 'yuki',
    title: 'Photography Walk',
    description: 'Golden hour along the river. Any camera, phones absolutely fine.',
    startsInDays: 13,
    hours: 3,
    location: 'Kyoto Riverside, Kyoto',
    visibility: 'public',
    tags: ['community'],
    createdDaysAgo: 6,
    going: ['marcus'],
  },
  {
    creator: 'sofia',
    title: 'Coffee & Code',
    description: 'No agenda, no talks. Bring whatever you are stuck on.',
    startsInDays: 20,
    hours: 2,
    location: 'Blue Bottle, Shoreditch, London',
    visibility: 'public',
    tags: [],
    createdDaysAgo: 1,
    going: ['grace', 'tom'],
  },
  {
    creator: 'marcus',
    title:
      'Annual Cross-Functional Product, Design and Engineering Alignment Summit with Extended Breakout Sessions',
    description:
      'A deliberately long title and description to check how the card grid and the detail page handle overflow. The full agenda runs across three tracks with parallel breakout sessions, lightning talks between each block, two panel discussions, and an open-floor retrospective at the end of the second day. Lunch is provided on both days and the venue has step-free access throughout.',
    startsInDays: 15,
    hours: 16,
    location: 'Eastside Conference Centre, Leeds',
    visibility: 'public',
    tags: ['conference'],
    createdDaysAgo: 25,
  },

  // ---------- private, so creator-only visibility is testable ----------
  {
    creator: 'ada',
    title: 'Founders Dinner',
    description: 'Small table, no agenda.',
    startsInDays: 7,
    hours: 2,
    location: 'Private venue, Soho, London',
    visibility: 'private',
    tags: ['networking'],
    createdDaysAgo: 16,
    going: ['grace'],
  },
  {
    creator: 'ada',
    title: 'Quarterly Roadmap Review',
    description: 'Internal only. Walking through what slipped and why.',
    startsInDays: 8,
    hours: 2,
    location: 'HQ, 4th floor',
    visibility: 'private',
    tags: ['leadership'],
    createdDaysAgo: 11,
  },
  {
    creator: 'ada',
    title: 'Team Offsite Planning',
    startsInDays: 25,
    hours: 6,
    location: 'Lake District Lodge, Cumbria',
    visibility: 'private',
    tags: ['leadership', 'workshop'],
    createdDaysAgo: 4,
    going: ['grace'],
  },
  {
    creator: 'priya',
    title: 'Interview Panel Sync',
    description: 'Private to the hiring panel. Calibrating scores before next week.',
    startsInDays: 5,
    hours: 1,
    location: 'Remote',
    visibility: 'private',
    tags: ['leadership'],
    createdDaysAgo: 7,
  },

  // ---------- currently running ----------
  {
    creator: 'omar',
    title: 'Incident Response Drill',
    description: 'Running right now. Started earlier today and finishes later this afternoon.',
    startsInDays: -0.05,
    hours: 3,
    location: 'Remote',
    visibility: 'public',
    tags: ['engineering', 'training'],
    createdDaysAgo: 14,
    going: ['ada', 'priya'],
  },

  // ---------- past ----------
  {
    creator: 'priya',
    title: 'Summer Meetup',
    description: 'Rooftop, far too much sun, a surprisingly good talk about caching.',
    startsInDays: -40,
    hours: 3,
    location: 'Rooftop, Lisbon',
    visibility: 'public',
    tags: ['meetup', 'community'],
    createdDaysAgo: 70,
    going: ['ada', 'grace', 'marcus', 'yuki', 'sofia', 'omar'],
  },
  {
    creator: 'yuki',
    title: 'Winter Hack Day',
    description: 'One day, eight projects, three of which still run in production.',
    startsInDays: -60,
    hours: 8,
    location: 'Tokyo Office, Tokyo',
    visibility: 'public',
    tags: ['hackathon', 'engineering'],
    createdDaysAgo: 95,
    going: ['ada', 'priya', 'grace', 'marcus', 'omar'],
  },
  {
    creator: 'grace',
    title: 'Legacy Migration Postmortem',
    description: 'What went wrong during the cutover and what we would do differently.',
    startsInDays: -25,
    hours: 2,
    location: 'Remote',
    visibility: 'public',
    tags: ['engineering', 'retro'],
    createdDaysAgo: 48,
    going: ['ada', 'priya', 'omar', 'sofia'],
  },
  {
    creator: 'ada',
    title: 'Onboarding Bootcamp',
    description: 'Two days of setup, architecture walkthroughs and pairing for the new joiners.',
    startsInDays: -90,
    hours: 16,
    location: 'HQ, 4th floor',
    visibility: 'public',
    tags: ['training'],
    createdDaysAgo: 120,
    going: ['grace', 'marcus', 'yuki', 'tom'],
  },
  {
    creator: 'ada',
    title: 'Q3 Retro',
    description: 'What went well, what did not, and the three things we are actually changing.',
    startsInDays: -10,
    hours: 1,
    location: 'HQ, 4th floor',
    visibility: 'public',
    tags: ['retro'],
    createdDaysAgo: 38,
    going: ['grace', 'priya', 'omar'],
  },
  {
    creator: 'marcus',
    title: 'Jazz Evening',
    startsInDays: -18,
    hours: 3,
    location: "Ronnie Scott's, London",
    visibility: 'public',
    tags: ['music'],
    createdDaysAgo: 29,
    going: ['sofia', 'yuki'],
  },
  {
    creator: 'sofia',
    title: 'Design Critique Session',
    description: 'Three flows reviewed, one redesigned on the spot.',
    startsInDays: -7,
    hours: 2,
    location: 'Remote',
    visibility: 'public',
    tags: ['design'],
    createdDaysAgo: 21,
    going: ['omar'],
    maybe: ['ada'],
  },
  {
    creator: 'omar',
    title: 'Budget Review',
    description: 'Private. Numbers for the next two quarters.',
    startsInDays: -30,
    hours: 2,
    location: 'HQ, 4th floor',
    visibility: 'private',
    tags: ['leadership'],
    createdDaysAgo: 45,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const emails = USERS.map((u) => u.email);
  await knex('users').whereIn('email', emails).del();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds: Record<string, number> = {};

  for (const user of USERS) {
    const [id] = await knex('users').insert({
      name: user.name,
      email: user.email,
      password_hash: passwordHash,
      email_verified_at: user.verified ? knex.fn.now() : null,
    });
    userIds[user.key] = id;
  }

  const tagIds: Record<string, number> = {};
  async function tagId(name: string): Promise<number> {
    if (tagIds[name]) return tagIds[name];
    const existing = await knex('tags').where({ name }).first();
    const id = existing ? existing.id : (await knex('tags').insert({ name }))[0];
    tagIds[name] = id;
    return id;
  }

  const at = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  for (const event of EVENTS) {
    const startsAt = at(event.startsInDays);
    const [eventId] = await knex('events').insert({
      creator_id: userIds[event.creator],
      title: event.title,
      description: event.description ?? null,
      starts_at: startsAt,
      ends_at: new Date(startsAt.getTime() + event.hours * 60 * 60 * 1000),
      location: event.location,
      visibility: event.visibility,
      created_at: at(-event.createdDaysAgo),
      updated_at: at(-event.createdDaysAgo),
    });

    for (const name of event.tags) {
      await knex('event_tags').insert({ event_id: eventId, tag_id: await tagId(name) });
    }

    const rsvps = [
      ...(event.going ?? []).map((key) => ({ key, status: 'going' as const })),
      ...(event.maybe ?? []).map((key) => ({ key, status: 'maybe' as const })),
      ...(event.notGoing ?? []).map((key) => ({ key, status: 'not_going' as const })),
    ];
    if (rsvps.length > 0) {
      await knex('event_rsvps').insert(
        rsvps.map((r) => ({ event_id: eventId, user_id: userIds[r.key], status: r.status })),
      );
    }
  }
}
