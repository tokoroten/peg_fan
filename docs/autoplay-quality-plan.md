# Autoplay Quality Plan

This project needs a deterministic autoplay audit so stage quality can be measured before publishing new layouts. The goal is not to make a perfect player. The goal is to catch boring, broken, or unfair stages automatically.

## Runner

- Use Playwright to load the built game in a browser.
- Force a fixed RNG seed and run one isolated stage at a time.
- Disable user input after each shot and wait until the ball is removed.
- Sample legal aim angles from `MIN_AIM_ANGLE` to `MAX_AIM_ANGLE`.
- Start with 25 evenly spaced candidate shots, then resample around the best 5 shots with narrower angle offsets.
- Repeat each candidate 3 times when moving parts or timed blocks exist.

## Metrics

- `clearRate`: percentage of sampled runs that clear all orange pegs within the stage ball count.
- `medianBallsToClear`: median balls used among successful clears.
- `targetProgress`: orange targets cleared per shot when the stage is not cleared.
- `deadShotRate`: percentage of shots that hit no target and score below a low threshold.
- `stuckRate`: percentage of shots that exceed a time limit or collide repeatedly with the same object.
- `catchRate`: percentage of balls caught by the bucket.
- `scoreSpread`: difference between low, median, and high scores.
- `gimmickContactRate`: percentage of runs that touch rails, timed blocks, spinners, or bumpers.
- `pathDiversity`: unique first-hit objects and unique target-clear orders.

## Quality Gates

- Reject if `clearRate` is 0 across the sampled policy.
- Reject if `deadShotRate` is above 55 percent.
- Reject if `stuckRate` is above 3 percent.
- Warn if `gimmickContactRate` is below 15 percent on a stage that contains gimmicks.
- Warn if `pathDiversity` is too low, because the stage is probably a single forced shot.
- Warn if `medianBallsToClear` is below 30 percent of the ball count, because the stage is likely too easy.
- Warn if no sampled run clears at least 70 percent of targets, because the stage is likely too hard or unreadable.

## Output

The future `npm run qa:auto` command should write:

- A JSON report per stage with raw sampled shots.
- A compact Markdown summary grouped by reject, warn, and pass.
- A screenshot overlay for rejected stages showing the best and worst sampled aim lines.

## First Implementation Scope

1. Add a Playwright script that loads a single stage and fires scripted aim angles.
2. Export browser-side debug hooks for stage load, shot launch, ball-settled detection, and score snapshot.
3. Run the audit against edited localStorage stages first, then expand to all 100 bundled stages.
4. Add the command to GitHub Actions after runtime is below roughly 10 minutes.
