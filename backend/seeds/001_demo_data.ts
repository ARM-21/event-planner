import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

// Fixed, known identifiers so re-running this seed is idempotent — it only
// ever touches these two demo accounts (and cascades to their own events/
// rsvps via the FKs), never anything a reviewer created by hand.
const DEMO_PASSWORD = 'Demo1234!';
const OWNER_EMAIL = 'demo@evently.dev';
const VIEWER_EMAIL = 'demo2@evently.dev';

export async function seed(knex: Knex): Promise<void> {
  await knex('users').whereIn('email', [OWNER_EMAIL, VIEWER_EMAIL]).del();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [ownerId] = await knex('users').insert({
    name: 'Ada Lovelace',
    email: OWNER_EMAIL,
    password_hash: passwordHash,
    email_verified_at: knex.fn.now(),
  });
  const [viewerId] = await knex('users').insert({
    name: 'Grace Hopper',
    email: VIEWER_EMAIL,
    password_hash: passwordHash,
    email_verified_at: knex.fn.now(),
  });

  async function tagId(name: string): Promise<number> {
    const existing = await knex('tags').where({ name }).first();
    if (existing) return existing.id;
    const [id] = await knex('tags').insert({ name });
    return id;
  }

  async function createEvent(input: {
    creatorId: number;
    title: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    location: string;
    visibility: 'public' | 'private';
    tags: string[];
  }): Promise<number> {
    const [id] = await knex('events').insert({
      creator_id: input.creatorId,
      title: input.title,
      description: input.description ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
      visibility: input.visibility,
    });
    for (const name of input.tags) {
      await knex('event_tags').insert({ event_id: id, tag_id: await tagId(name) });
    }
    return id;
  }

  const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  const hoursAfter = (base: Date, n: number) => new Date(base.getTime() + n * 60 * 60 * 1000);

  const conference = await createEvent({
    creatorId: ownerId,
    title: 'Future of Work Conference',
    description:
      'A day of talks on remote-first teams, async collaboration, and the tools reshaping how we work.',
    startsAt: days(3),
    endsAt: hoursAfter(days(3), 8),
    location: 'Austin Convention Center, Austin, TX',
    visibility: 'public',
    tags: ['conference', 'leadership'],
  });

  const workshop = await createEvent({
    creatorId: ownerId,
    title: 'Design Systems Workshop',
    description: 'Hands-on session building a token-based component library from scratch.',
    startsAt: days(5),
    endsAt: hoursAfter(days(5), 1.5),
    location: 'Remote',
    visibility: 'public',
    tags: ['design', 'workshop'],
  });

  await createEvent({
    creatorId: ownerId,
    title: 'Founders Dinner',
    startsAt: days(7),
    endsAt: hoursAfter(days(7), 2),
    location: 'Private venue',
    visibility: 'private',
    tags: ['networking'],
  });

  await createEvent({
    creatorId: viewerId,
    title: 'Open Source Office Hours',
    description: 'Drop-in Q&A for anyone contributing to the project.',
    startsAt: days(2),
    endsAt: hoursAfter(days(2), 1),
    location: 'Remote',
    visibility: 'public',
    tags: ['community'],
  });

  await createEvent({
    creatorId: ownerId,
    title: 'Q3 Retro',
    startsAt: days(-10),
    endsAt: hoursAfter(days(-10), 1),
    location: 'HQ — 4th floor',
    visibility: 'public',
    tags: ['retro'],
  });

  // Gives the going-count and popularity sort real data to show.
  await knex('event_rsvps').insert([
    { event_id: conference, user_id: viewerId, status: 'going' },
    { event_id: workshop, user_id: viewerId, status: 'maybe' },
  ]);
}
