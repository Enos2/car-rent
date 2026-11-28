// Project: Via Nostra
// File: frontend/lib/trust.ts
// Purpose: The shapes of the data for ratings, reports and blog posts, and the
//          labels the pages use for them.

export type ReviewSummary = { average: number | null; count: number };

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorFirstName: string;
  createdAt: string;
};

export type CarReviewsResponse = {
  summary: ReviewSummary;
  items: PublicReview[];
  limit: number;
  offset: number;
};

export type PendingReview = {
  bookingId: string;
  direction: 'renter_to_owner' | 'owner_to_renter';
  carId: string;
  carMake: string;
  carModel: string;
  otherParty: string;
  returnedAt: string;
};

export type ReportTarget = 'car' | 'user' | 'review' | 'post';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type ReportItem = {
  id: string;
  reporterId: string;
  reporterEmail: string;
  targetType: ReportTarget;
  targetId: string;
  targetLabel: string | null;
  reason: string;
  details: string;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  authorName: string;
};

export type PostDetail = PostSummary & { body: string };

export type AdminPost = PostDetail & {
  status: 'draft' | 'published' | 'hidden';
  createdAt: string;
  updatedAt: string;
};

export const REPORT_REASONS = [
  { value: 'scam_or_fake', label: 'Scam or fake listing' },
  { value: 'unsafe_or_damaged', label: 'Unsafe or damaged car' },
  { value: 'misleading_listing', label: 'Misleading listing' },
  { value: 'abusive_behaviour', label: 'Abusive behaviour' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

export const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((reason) => [reason.value, reason.label]),
);

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  car: 'Car',
  user: 'Person',
  review: 'Review',
  post: 'Blog post',
};

// File: frontend/lib/trust.ts
// END OF FILE