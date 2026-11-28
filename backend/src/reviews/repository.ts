// Project: Via Nostra
// File: backend/src/reviews/repository.ts
// Purpose: Database work for reviews: creating a review of a finished rental (one per
//          person per booking, within 30 days), listing the public reviews and the
//          rating of a car, finding the reviews a person can still write, and hiding
//          or showing a review.

import { pool } from '../db.js';
import { isUniqueViolation } from '../http.js';

export const REVIEW_WINDOW_DAYS = 30;

export type Direction = 'renter_to_owner' | 'owner_to_renter';

export type Review = {
  id: string;
  bookingId: string;
  carId: string;
  authorId: string;
  subjectId: string;
  direction: Direction;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: Date;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorFirstName: string;
  createdAt: Date;
};

export type PendingReview = {
  bookingId: string;
  direction: Direction;
  carId: string;
  carMake: string;
  carModel: string;
  otherParty: string;
  returnedAt: Date;
};

const REVIEW_COLUMNS = `
  id, booking_id AS "bookingId", car_id AS "carId", author_id AS "authorId",
  subject_id AS "subjectId", direction, rating, comment, is_hidden AS "isHidden",
  created_at AS "createdAt"
`;

export type CreateReviewOutcome =
  | { ok: true; review: Review }
  | { ok: false; reason: 'not_found' | 'not_completed' | 'window_closed' | 'duplicate' };

export async function createReview(input: {
  bookingId: string;
  authorId: string;
  rating: number;
  comment: string | null;
}): Promise<CreateReviewOutcome> {
  const found = await pool.query<{
    carId: string;
    renterId: string;
    ownerId: string;
    status: string;
    returnedAt: Date | null;
  }>(
    `SELECT car_id AS "carId", renter_id AS "renterId", owner_id AS "ownerId", status,
            returned_at AS "returnedAt"
     FROM bookings WHERE id = $1`,
    [input.bookingId],
  );
  const booking = found.rows[0];
  if (!booking || (booking.renterId !== input.authorId && booking.ownerId !== input.authorId)) {
    return { ok: false, reason: 'not_found' };
  }
  if (booking.status !== 'completed') {
    return { ok: false, reason: 'not_completed' };
  }
  const windowMs = REVIEW_WINDOW_DAYS * 86_400_000;
  if (!booking.returnedAt || Date.now() - booking.returnedAt.getTime() > windowMs) {
    return { ok: false, reason: 'window_closed' };
  }

  const direction: Direction = booking.renterId === input.authorId ? 'renter_to_owner' : 'owner_to_renter';
  const subjectId = direction === 'renter_to_owner' ? booking.ownerId : booking.renterId;

  try {
    const inserted = await pool.query<Review>(
      `INSERT INTO reviews (booking_id, car_id, author_id, subject_id, direction, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${REVIEW_COLUMNS}`,
      [input.bookingId, booking.carId, input.authorId, subjectId, direction, input.rating, input.comment],
    );
    const review = inserted.rows[0];
    if (!review) {
      throw new Error('The review was not saved');
    }
    return { ok: true, review };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'duplicate' };
    }
    throw error;
  }
}

export async function listPendingReviews(userId: string): Promise<PendingReview[]> {
  const result = await pool.query<PendingReview>(
    `SELECT b.id AS "bookingId",
            CASE WHEN b.renter_id = $1 THEN 'renter_to_owner' ELSE 'owner_to_renter' END AS direction,
            b.car_id AS "carId", c.make AS "carMake", c.model AS "carModel",
            CASE WHEN b.renter_id = $1
                 THEN COALESCE(ou.company_name, split_part(ou.full_name, ' ', 1))
                 ELSE split_part(ru.full_name, ' ', 1) END AS "otherParty",
            b.returned_at AS "returnedAt"
     FROM bookings b
     JOIN cars c ON c.id = b.car_id
     JOIN users ru ON ru.id = b.renter_id
     JOIN users ou ON ou.id = b.owner_id
     WHERE b.status = 'completed'
       AND b.returned_at > now() - make_interval(days => $2::int)
       AND (b.renter_id = $1 OR b.owner_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM reviews r
         WHERE r.booking_id = b.id
           AND r.direction = (CASE WHEN b.renter_id = $1
                                   THEN 'renter_to_owner' ELSE 'owner_to_renter' END)::review_direction
       )
     ORDER BY b.returned_at DESC`,
    [userId, REVIEW_WINDOW_DAYS],
  );
  return result.rows;
}

export async function getCarReviews(
  carId: string,
  limit: number,
  offset: number,
): Promise<{ summary: { average: number | null; count: number }; items: PublicReview[] }> {
  const summary = await pool.query<{ average: number | null; count: number }>(
    `SELECT round(avg(rating)::numeric, 1)::float8 AS average, count(*)::int AS count
     FROM reviews
     WHERE car_id = $1 AND direction = 'renter_to_owner' AND is_hidden = false`,
    [carId],
  );
  const items = await pool.query<PublicReview>(
    `SELECT r.id, r.rating, r.comment, split_part(u.full_name, ' ', 1) AS "authorFirstName",
            r.created_at AS "createdAt"
     FROM reviews r JOIN users u ON u.id = r.author_id
     WHERE r.car_id = $1 AND r.direction = 'renter_to_owner' AND r.is_hidden = false
     ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [carId, limit, offset],
  );
  return {
    summary: summary.rows[0] ?? { average: null, count: 0 },
    items: items.rows,
  };
}

export async function setReviewHidden(id: string, hidden: boolean): Promise<Review | null> {
  const result = await pool.query<Review>(
    `UPDATE reviews SET is_hidden = $2 WHERE id = $1 RETURNING ${REVIEW_COLUMNS}`,
    [id, hidden],
  );
  return result.rows[0] ?? null;
}

// File: backend/src/reviews/repository.ts
// END OF FILE