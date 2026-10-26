import { resolveExerciseSwipeDirection } from '../exerciseSwipe';

describe('resolveExerciseSwipeDirection', () => {
  const available = { canPrevious: true, canNext: true };

  it('maps a left swipe to the next exercise', () => {
    expect(
      resolveExerciseSwipeDirection({
        ...available,
        translationX: -60,
        velocityX: -200,
      }),
    ).toBe(1);
  });

  it('maps a right swipe to the previous exercise', () => {
    expect(
      resolveExerciseSwipeDirection({
        ...available,
        translationX: 60,
        velocityX: 200,
      }),
    ).toBe(-1);
  });

  it('accepts a deliberate short flick', () => {
    expect(
      resolveExerciseSwipeDirection({
        ...available,
        translationX: -24,
        velocityX: -800,
      }),
    ).toBe(1);
  });

  it('ignores short or accidental movement', () => {
    expect(
      resolveExerciseSwipeDirection({
        ...available,
        translationX: -17,
        velocityX: -900,
      }),
    ).toBe(0);
    expect(
      resolveExerciseSwipeDirection({
        ...available,
        translationX: 32,
        velocityX: 300,
      }),
    ).toBe(0);
  });

  it('does not wrap past either end of the exercise list', () => {
    expect(
      resolveExerciseSwipeDirection({
        translationX: 80,
        velocityX: 700,
        canPrevious: false,
        canNext: true,
      }),
    ).toBe(0);
    expect(
      resolveExerciseSwipeDirection({
        translationX: -80,
        velocityX: -700,
        canPrevious: true,
        canNext: false,
      }),
    ).toBe(0);
  });
});
