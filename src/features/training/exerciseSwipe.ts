export const EXERCISE_SWIPE_DISTANCE = 48;
export const EXERCISE_SWIPE_VELOCITY = 650;

export type ExerciseSwipeDirection = -1 | 0 | 1;

interface ResolveExerciseSwipeDirectionInput {
  translationX: number;
  velocityX: number;
  canPrevious: boolean;
  canNext: boolean;
}

/**
 * Resolve a completed horizontal gesture into an adjacent exercise change.
 *
 * - `1` means next exercise (left swipe).
 * - `-1` means previous exercise (right swipe).
 * - `0` means stay put.
 *
 * A short, fast flick is accepted, but it still needs a small amount of
 * horizontal travel so an incidental tap release cannot change exercises.
 */
export function resolveExerciseSwipeDirection({
  translationX,
  velocityX,
  canPrevious,
  canNext,
}: ResolveExerciseSwipeDirectionInput): ExerciseSwipeDirection {
  const passedDistance = Math.abs(translationX) >= EXERCISE_SWIPE_DISTANCE;
  const passedVelocity =
    Math.abs(translationX) >= 18 &&
    Math.abs(velocityX) >= EXERCISE_SWIPE_VELOCITY;

  if (!passedDistance && !passedVelocity) return 0;

  const intentX =
    Math.abs(translationX) >= 18 ? translationX : velocityX;

  if (intentX < 0) return canNext ? 1 : 0;
  if (intentX > 0) return canPrevious ? -1 : 0;
  return 0;
}
