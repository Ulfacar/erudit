-- Add social-goal tagging and target classes for school events.
CREATE TYPE "EventSocialGoal" AS ENUM (
  'integration',
  'adaptation',
  'teambuilding',
  'friendship',
  'tradition',
  'discipline_council',
  'civic'
);

ALTER TABLE "SchoolEvent"
  ADD COLUMN "socialGoal" "EventSocialGoal",
  ADD COLUMN "targetClassIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
