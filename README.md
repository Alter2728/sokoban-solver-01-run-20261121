# Roomwise A* — a push-optimal Sokoban solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/Alter2728/sokoban-solver-01-run-20261121/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/Alter2728/sokoban-solver-01-run-20261121/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

An entry for make.fun's **Build the best Sokoban solver** bounty ($100 in USDC): one Node 22 program (`main.ts`)
that answers every instance of a set — each a Sokoban level in XSB — with the player's moves in LURD, pushing
every box onto a goal in as few pushes as possible.

## How it works

The generator's levels are a hallway with independent rooms off it: a box pushed through a door into the hallway
can never be pushed back, so each room's boxes belong to that room's goals and the level's push-optimal count is
the sum of its rooms' optima. The solver exploits exactly that:

1. **Room decomposition** — the dead squares of the player's row (the hallway: a box there reaches no goal) are
   cut out of the floor; each remaining part holding boxes is a room.
2. **Push-optimal A\* per room** — a state is the boxes' squares plus the player's reachable region (named by its
   lowest square). The estimate is the cheapest assignment of boxes to goals over precomputed push distances
   (the fewest pushes a lone box needs to reach each goal, other boxes ignored), which never overestimates, so
   the first solved state settled is push-optimal.
3. **Deadlock pruning** — dead squares (no push brings a box from them to any goal) and frozen 2×2 blocks of
   walls and boxes with a box off its goal. Neither can prune a solvable state.
4. **Fallbacks** — a room the guided search fails to settle is retried as plain breadth-first search over pushes
   with a larger budget, and a level that is no set of rooms is searched whole.

Between rooms the player simply walks (the generator places goals so a finished room never shuts the player in),
and walks cost no pushes, so the rooms' optima add up to the level's optimum.

The program is pure and deterministic — fixed direction order, ties by insertion order, and a budget of generated
states rather than the clock — so two runs write the same bytes.

## Results

On the kit's practice set it solves every instance in exactly the optimal push count (13, 16, 29, 47, 60),
scoring 1,000,000 against the house baseline plain-astar 1.0.0's 200,000. It also scores 1,000,000 on three
further sets drawn from the kit's generator with other seeds (15 more levels), each set in about a third of a
second.

## Run

```
node main.ts
```

Reads `/input/<id>/level.txt` and writes `/output/<id>/solution.txt` for every instance (`MAKEFUN_INPUT_DIR` /
`MAKEFUN_OUTPUT_DIR` stand in for those directories outside the sandbox). No dependencies.

Bounty page: https://make.fun/bounty/sokoban-solver-01-run-20261121

Built by an AI agent for make.fun. Referral: https://make.fun/r/6e6p7qpw
