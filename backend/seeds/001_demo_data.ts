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
      'A full day across two tracks on remote-first teams, async collaboration and the tooling that actually holds up at scale. Talks run forty minutes with real time for questions, and the hallway track is deliberately long. Lunch and coffee included.',
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
    description: 'An easy 8k loop at conversational pace, which in practice means nobody gets dropped. We regroup at every gate and there is a slightly faster group for anyone who wants one. Bring water, and the cafe at the end does a good flat white.',
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
    description: 'Two days, any stack, teams of up to four, and a five-minute demo at the end. API credits and hardware provided, along with far too much pizza. The prizes are deliberately small so people build the thing they actually wanted to build.',
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
      'Scheduling, resource limits, and what actually happens when a pod gets evicted at three in the morning. Half the session is hands-on against a throwaway cluster, so bring a laptop with kubectl already working.',
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
    description: 'Five engineers on career switches, staying technical past senior, and learning to say no to hero work. Audience questions take the whole second half, and there is time afterwards for the conversations people would rather have off the record.',
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
    description: 'Building a token-based component library from scratch, starting with colour and spacing scales and finishing with a button that survives a theme switch. Bring a laptop with Figma and Node already installed.',
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
    description: 'Thirty stalls, three live sets across the afternoon, and one queue for the dumplings that is genuinely worth standing in. Cash and card both fine, dogs welcome, and most stalls have a vegetarian option.',
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
      'Composite indexes, covering indexes, and reading an EXPLAIN plan without guessing your way through it. We work against a deliberately badly indexed database and fix it together. The query planner is far less mysterious once you watch it change its mind.',
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
    description: 'Drop in with whatever is blocking your first pull request, whether that is the build, the test suite, or just picking an issue to start on. No question is too small and nothing is recorded.',
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
    description: 'From `Array<T>` through constraints and inference to conditional types, including the parts most tutorials skip because they are awkward to explain. Every example comes from a real codebase rather than a toy type.',
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
    description: 'Ownership, borrowing and lifetimes explained for people who already think in closures and garbage collection. We port a small Node script across so the comparison stays concrete rather than theoretical.',
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
    description: 'Five minutes each, honest feedback from the room, and no slides at all in the first round so the story has to stand on its own. Bring the deck for the second round.',
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
    description: 'Heavy euros on one table, party games on the other, and someone will inevitably try to teach Brass to a table of six. Snacks provided, and bring a game if you have a favourite.',
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
    description: 'Four local bands across the evening, doors at seven and the last set finished by eleven. Bar open throughout, tickets on the door only.',
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
    description: 'The sign-up sheet goes up at six and fills fast. Five minutes each, any format, music and spoken word equally welcome. A house guitar and an amp are there if you would rather travel light.',
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
    description: 'One afternoon spent entirely on the getting-started guide nobody has touched since the rewrite. Pairs work through it exactly as a new user would, and every stumble becomes an issue.',
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
    description: 'We ran written standups for a month instead of the daily call. This session compares notes on what improved, what quietly broke, and whether any of it is worth keeping.',
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
    description: 'Bring one page from your product and leave with a prioritised list of fixes. We go through it using a screen reader and the keyboard only, which is usually the part that changes minds.',
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
    description: 'Golden hour along the river, finishing at the bridge for the last of the light. Any camera at all, phones absolutely fine, and there is no skill floor for turning up.',
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
    description: 'No agenda, no talks, no projector. Bring whatever you are stuck on, or just sit with a laptop and get your own work done alongside other people doing the same.',
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
    description: 'A small table and no agenda beyond whatever people actually want to talk about. Twelve seats, dinner is covered, and nothing leaves the room.',
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
    description: 'Internal only. Walking through what shipped, what slipped, and honestly why, before next quarter planning starts.',
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
    description: 'Private to the hiring panel. Calibrating scores and agreeing what the bar actually looks like before next week loop.',
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
    description: 'A simulated outage run end to end, with a real pager rotation and a deliberately unhelpful dashboard. Started earlier today and runs through the afternoon.',
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
    description: 'A rooftop, far too much sun, and a surprisingly good talk about caching that people still bring up. Two short talks and then the rest of the evening left deliberately unstructured.',
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
    description: 'One day, eight projects, and three of them somehow still running in production a year later. Demos at five, no judging and no prizes.',
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
    description: 'What went wrong during the cutover, in what order, and how much of it we could realistically have predicted. Blameless format, and the timeline goes on the wall before anyone speaks.',
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
    description: 'Two days for new joiners. Environment setup on the first morning, architecture walkthroughs after lunch, then pairing on a real ticket for the whole of day two.',
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
    description: 'What went well, what did not, and the three things we are actually changing rather than the twelve we could list. Every action has an owner before anyone leaves the room.',
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
    description: 'Three flows reviewed properly, one of them redesigned on the spot once it was clear the problem sat upstream of the screen. Bring work in progress rather than finished pieces.',
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
    description: 'Private. Headcount and spend for the next two quarters, with the awkward conversations happening in the room rather than over email.',
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
