import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all categories and publishers in name order', async () => {
        await db.insert(categories).values([
            { name: 'Puzzle', description: 'p1' },
            { name: 'Action', description: 'p2' },
        ]);
        await db.insert(publishers).values([
            { name: 'Beta Games', description: 'b' },
            { name: 'Alpha Studio', description: 'a' },
        ]);

        expect(await getAllCategories(db)).toEqual([
            { id: expect.any(Number), name: 'Action' },
            { id: expect.any(Number), name: 'Puzzle' },
        ]);
        expect(await getAllPublishers(db)).toEqual([
            { id: expect.any(Number), name: 'Alpha Studio' },
            { id: expect.any(Number), name: 'Beta Games' },
        ]);
    });

    it('filters games by category and publisher together', async () => {
        const [strategy] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat1' })
            .returning({ id: categories.id });
        const [puzzle] = await db
            .insert(categories)
            .values({ name: 'Puzzle', description: 'cat2' })
            .returning({ id: categories.id });
        const [alpha] = await db
            .insert(publishers)
            .values({ name: 'Alpha Studio', description: 'pub1' })
            .returning({ id: publishers.id });
        const [beta] = await db
            .insert(publishers)
            .values({ name: 'Beta Games', description: 'pub2' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha Strategy', description: 'a', starRating: 4.5, categoryId: strategy.id, publisherId: alpha.id },
            { title: 'Alpha Puzzle', description: 'b', starRating: 4.1, categoryId: puzzle.id, publisherId: alpha.id },
            { title: 'Beta Strategy', description: 'c', starRating: 3.9, categoryId: strategy.id, publisherId: beta.id },
        ]);

        const filtered = await getGamesByFilters(db, {
            categoryIds: [strategy.id],
            publisherIds: [alpha.id],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha Strategy']);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
