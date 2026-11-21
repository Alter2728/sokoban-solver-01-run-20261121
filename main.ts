// Roomwise A*: a push-optimal Sokoban solver for make.fun's sokoban-solver-01.
//
// The generator's levels are a hallway with independent rooms off it: a box pushed through a door into the
// hallway can never come back, so each room's boxes belong to that room's goals and the level's push-optimal
// count is the sum of its rooms' optima. This solver cuts the dead squares of the player's row (the hallway)
// out of the floor, takes each remaining part holding boxes as a room, and solves every room on its own with
// A* over pushes (a state is the boxes' squares and the player's reachable region, named by its lowest square).
// The estimate is the cheapest assignment of boxes to goals over precomputed push distances (how many pushes a
// lone box needs to reach each goal, ignoring the other boxes), which never overestimates, so the first solved
// state the search settles is push-optimal. Two deadlocks are pruned, neither of which can prune a solvable
// state: a dead square (no push brings a box from it to any goal) and a frozen 2x2 block of walls and boxes
// with a box off its goal. Between rooms the player simply walks: the generator places goals so a finished
// room never shuts the player in. A level that is no set of rooms falls back to the same search over the whole
// board. Pure and deterministic: fixed direction order, ties by insertion order, and a budget of generated
// states, never the clock, so two runs write the same bytes.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The most states one room's search keeps before it gives up: work, never the clock. */
const MAX_STATES = 800_000;
/** The four directions: [dx, dy, the move's letter, the push's letter]. */
const DIRS: [number, number, string, string][] = [
  [0, -1, 'u', 'U'],
  [0, 1, 'd', 'D'],
  [-1, 0, 'l', 'L'],
  [1, 0, 'r', 'R'],
];

type Level = { w: number; h: number; wall: Uint8Array; goals: number[]; boxes: number[]; player: number };

/** A level in XSB text (# wall, space floor, . goal, $ box, * box on a goal, @ player, + player on a goal). */
function parseLevel(text: string): Level {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1);
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goals.push(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  // A square on the outermost frame is a wall whatever it shows: nothing leaves the board.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
  return { w, h, wall, goals, boxes: boxes.sort((a, b) => a - b), player };
}

/** The squares from which a box alone can be pushed onto some goal (pulled back from the goals over open floor). */
function liveSquares(level: Level): Uint8Array {
  const { w, wall, goals } = level;
  const live = new Uint8Array(wall.length);
  const queue = [...goals];
  for (const g of goals) live[g] = 1;
  for (let qi = 0; qi < queue.length; qi++) {
    const x = queue[qi]!;
    for (const [dx, dy] of DIRS) {
      const d = dy * w + dx;
      const y = x - d;
      if (!wall[y] && !wall[y - d] && !live[y]) {
        live[y] = 1;
        queue.push(y);
      }
    }
  }
  return live;
}

/**
 * Push distances to each goal: tables[g][s] is the fewest pushes that bring a lone box from s to goal g
 * (the player may stand on any floor square, other boxes ignored), or -1 when no push sequence does.
 * Computed backwards from each goal: a box now at t came from t-d when t-d and t-2d are both floor.
 */
function pushTables(level: Level): Int32Array[] {
  const { w, wall, goals } = level;
  return goals.map((g) => {
    const dist = new Int32Array(wall.length).fill(-1);
    dist[g] = 0;
    const queue = [g];
    for (let qi = 0; qi < queue.length; qi++) {
      const t = queue[qi]!;
      for (const [dx, dy] of DIRS) {
        const d = dy * w + dx;
        const s = t - d;
        if (dist[s] === -1 && !wall[s] && !wall[s - d]) {
          dist[s] = dist[t]! + 1;
          queue.push(s);
        }
      }
    }
    return dist;
  });
}

/** The squares the player reaches from `from` with `occupied` (a box mask) in the way, marked in `seen` with `stamp`; the lowest. */
function reach(level: Level, occupied: Uint8Array, from: number, seen: Int32Array, stamp: number, stack: Int32Array): number {
  const { w, wall } = level;
  let low = from;
  let n = 0;
  stack[n++] = from;
  seen[from] = stamp;
  while (n > 0) {
    const p = stack[--n]!;
    if (p < low) low = p;
    for (let k = 0; k < 4; k++) {
      const q = k === 0 ? p - w : k === 1 ? p + w : k === 2 ? p - 1 : p + 1;
      if (wall[q] === 0 && occupied[q] === 0 && seen[q] !== stamp) {
        seen[q] = stamp;
        stack[n++] = q;
      }
    }
  }
  return low;
}

/** Whether the box just pushed to `t` sits in a frozen 2x2 block of walls and boxes with a box off its goal. */
function frozenBlock(level: Level, occupied: Uint8Array, goal: Uint8Array, t: number): boolean {
  const { w, wall } = level;
  for (const a of [t, t - 1, t - w, t - w - 1]) {
    const b = a + 1;
    const c = a + w;
    const d = c + 1;
    if (!(wall[a] || occupied[a]) || !(wall[b] || occupied[b]) || !(wall[c] || occupied[c]) || !(wall[d] || occupied[d])) continue;
    if ((occupied[a] && !goal[a]) || (occupied[b] && !goal[b]) || (occupied[c] && !goal[c]) || (occupied[d] && !goal[d])) return true;
  }
  return false;
}

/**
 * The push-optimal solution of `level`, searching at most `maxStates` states: {pushes, moves} (moves in LURD:
 * a lower letter a step, an upper one a push), or null when the search gives up (or the level has no solution).
 * With `useHeuristic` false the estimate is 0 and the same search runs as a plain breadth-first search over
 * pushes — slower, but a second chance for a room the guided search somehow fails to settle within its budget.
 */
function solvePushOptimal(level: Level, maxStates = MAX_STATES, useHeuristic = true): { pushes: number; moves: string } | null {
  const { w, wall, goals } = level;
  const size = wall.length;
  const n = level.boxes.length;
  const goal = new Uint8Array(size);
  for (const g of goals) goal[g] = 1;
  const live = liveSquares(level);
  if (level.boxes.some((b) => !live[b])) return null;
  const tables = pushTables(level);
  // The estimate: the cheapest assignment of boxes to distinct goals over the push tables (DP over subsets
  // for few boxes, each box's nearest goal summed otherwise). A box that reaches no goal makes it infinite.
  const estimate = (boxes: number[]): number => {
    if (!useHeuristic) return 0;
    if (n <= 6) {
      const full = (1 << n) - 1;
      const dp = new Array<number>(1 << n).fill(Infinity);
      dp[0] = 0;
      for (let mask = 0; mask <= full; mask++) {
        const bi = popcount(mask);
        if (bi >= n || dp[mask] === Infinity) continue;
        for (let gi = 0; gi < n; gi++) {
          if (mask & (1 << gi)) continue;
          const c = tables[gi]![boxes[bi]!]!;
          if (c >= 0) dp[mask | (1 << gi)] = Math.min(dp[mask | (1 << gi)]!, dp[mask]! + c);
        }
      }
      return dp[full]!;
    }
    let sum = 0;
    for (const b of boxes) {
      let best = Infinity;
      for (const t of tables) if (t[b]! >= 0) best = Math.min(best, t[b]!);
      if (best === Infinity) return Infinity;
      sum += best;
    }
    return sum;
  };
  const occupied = new Uint8Array(size);
  const seen = new Int32Array(size);
  const mark = new Int32Array(size);
  const stack = new Int32Array(size);
  let stamp = 0;
  const solved = (boxes: number[]): boolean => boxes.every((b) => goal[b] === 1);
  const keyOf = (boxes: number[], low: number): string => String.fromCharCode(low, ...boxes);
  // The states in the order found: boxes (flat, n a state), the player's square, pushes so far, parent.
  const stBoxes: number[] = [...level.boxes];
  const stPlayer: number[] = [level.player];
  const stG: number[] = [0];
  const parent: number[] = [-1];
  const bestG = new Map<string, number>();
  for (const b of level.boxes) occupied[b] = 1;
  bestG.set(keyOf(level.boxes, reach(level, occupied, level.player, seen, ++stamp, stack)), 0);
  for (const b of level.boxes) occupied[b] = 0;
  // The open list: a heap on (f, h, insertion order), so ties settle the same way on every run.
  const heap: [number, number, number][] = [];
  const less = (a: [number, number, number], b: [number, number, number]): boolean =>
    a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])));
  const hPush = (e: [number, number, number]): void => {
    let i = heap.length;
    heap.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const hPop = (): [number, number, number] => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && less(heap[c + 1]!, heap[c]!)) c++;
        if (!less(heap[c]!, heap[i]!)) break;
        [heap[i], heap[c]] = [heap[c]!, heap[i]!];
        i = c;
      }
    }
    return top;
  };
  const h0 = estimate(level.boxes);
  if (h0 === Infinity) return null;
  hPush([h0, h0, 0]);
  let found = -1;
  while (heap.length > 0 && found < 0) {
    const [, , s] = hPop();
    const boxes = stBoxes.slice(s * n, s * n + n);
    for (const b of boxes) occupied[b] = 1;
    const low = reach(level, occupied, stPlayer[s]!, seen, ++stamp, stack);
    if (bestG.get(keyOf(boxes, low)) !== stG[s]) {
      for (const x of boxes) occupied[x] = 0;
      continue;
    }
    if (solved(boxes)) {
      found = s;
      for (const x of boxes) occupied[x] = 0;
      break;
    }
    const here = stamp;
    const g = stG[s]!;
    for (let bi = 0; bi < n; bi++) {
      const b = boxes[bi]!;
      for (const [dx, dy] of DIRS) {
        const d = dy * w + dx;
        const t = b + d;
        if (seen[b - d] !== here || wall[t] || occupied[t] || !live[t]) continue;
        occupied[b] = 0;
        occupied[t] = 1;
        const frozen = frozenBlock(level, occupied, goal, t);
        let next: number[] | null = null;
        let key = '';
        let nLow = -1;
        if (!frozen) {
          next = boxes.slice();
          next[bi] = t;
          next.sort((x, y) => x - y);
          nLow = reach(level, occupied, b, mark, ++stamp, stack);
          key = keyOf(next, nLow);
        }
        occupied[t] = 0;
        occupied[b] = 1;
        if (frozen || next === null) continue;
        const seenG = bestG.get(key);
        if (seenG !== undefined && seenG <= g + 1) continue;
        const h = estimate(next);
        if (h === Infinity) continue;
        if (stPlayer.length >= maxStates) {
          for (const x of boxes) occupied[x] = 0;
          return null;
        }
        bestG.set(key, g + 1);
        stBoxes.push(...next);
        stPlayer.push(b);
        stG.push(g + 1);
        parent.push(s);
        hPush([g + 1 + h, h, stPlayer.length - 1]);
      }
    }
    for (const x of boxes) occupied[x] = 0;
  }
  if (found < 0) return null;
  // The path of states, then the moves: walk to each push's square, then push.
  const path: number[] = [];
  for (let s = found; s > 0; s = parent[s]!) path.push(s);
  path.reverse();
  let moves = '';
  let player = level.player;
  let boxes = level.boxes;
  for (const s of path) {
    const nextBoxes = stBoxes.slice(s * n, s * n + n);
    const from = boxes.find((b) => !nextBoxes.includes(b))!;
    const to = nextBoxes.find((b) => !boxes.includes(b))!;
    const d = to - from;
    const dir = DIRS.find(([dx, dy]) => dy * w + dx === d)!;
    for (const b of boxes) occupied[b] = 1;
    moves += walkTo(level, occupied, player, from - d);
    for (const b of boxes) occupied[b] = 0;
    moves += dir[3];
    player = from;
    boxes = nextBoxes;
  }
  return { pushes: path.length, moves };
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

/** The shortest walk from `from` to `to` around walls and boxes, in lower LURD letters (the first direction first on ties). */
function walkTo(level: Level, occupied: Uint8Array, from: number, to: number): string {
  const { w, wall } = level;
  if (from === to) return '';
  const prev = new Int32Array(wall.length).fill(-1);
  const how = new Array<string>(wall.length);
  const queue = [from];
  prev[from] = from;
  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]!;
    if (p === to) break;
    for (const [dx, dy, letter] of DIRS) {
      const q = p + dy * w + dx;
      if (wall[q] || occupied[q] || prev[q] !== -1) continue;
      prev[q] = p;
      how[q] = letter;
      queue.push(q);
    }
  }
  if (prev[to] === -1) throw new Error('walkTo: the push square is out of reach');
  let s = '';
  for (let p = to; p !== from; p = prev[p]!) s = how[p] + s;
  return s;
}

/** The square the player stands on after `moves` (LURD, the case aside) from `from` on a board `w` wide. */
function endOf(w: number, from: number, moves: string): number {
  let p = from;
  for (const ch of moves.toLowerCase()) p += ch === 'u' ? -w : ch === 'd' ? w : ch === 'l' ? -1 : 1;
  return p;
}

type Room = { squares: number[]; boxes: number[]; goals: number[]; done?: boolean };

/**
 * The level's rooms: cut the dead squares of the player's row (the hallway: a box there reaches no goal) out of the
 * floor, and each part left that holds a box is a room, its squares, boxes and goals. Null when some part holds more
 * or fewer boxes than goals, or a box starts in the hallway: then the level is no set of rooms.
 */
function roomsOf(level: Level): Room[] | null {
  const { w, wall, goals, boxes, player } = level;
  const live = liveSquares(level);
  const row = Math.floor(player / w);
  const cut = new Uint8Array(wall.length);
  for (let i = row * w; i < (row + 1) * w; i++) if (!wall[i] && !live[i]) cut[i] = 1;
  if (boxes.some((b) => cut[b])) return null;
  const part = new Int32Array(wall.length).fill(-1);
  const rooms: Room[] = [];
  for (let s = 0; s < wall.length; s++) {
    if (wall[s] || cut[s] || part[s] >= 0) continue;
    const squares = [s];
    part[s] = rooms.length;
    for (let i = 0; i < squares.length; i++) {
      for (const [dx, dy] of DIRS) {
        const q = squares[i]! + dy * w + dx;
        if (!wall[q] && !cut[q] && part[q] < 0) {
          part[q] = rooms.length;
          squares.push(q);
        }
      }
    }
    rooms.push({ squares, boxes: [], goals: [] });
  }
  for (const b of boxes) rooms[part[b]!]!.boxes.push(b);
  for (const g of goals) if (part[g]! >= 0) rooms[part[g]!]!.goals.push(g);
  if (goals.some((g) => part[g]! < 0) || rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}

/**
 * The level solved room by room: each room's push-optimal solution in turn, the other rooms' boxes standing as
 * walls (on their goals once their room is done), the player walking on from where the last room left it. A box
 * never leaves its room (a push through a door lands it in the hallway, where it reaches no goal), so the rooms'
 * optima add up to the level's: {pushes, moves}, or null when a room's search gives up, or the level is no set
 * of rooms and the search over the whole level gives up.
 */
function solveByRooms(level: Level): { pushes: number; moves: string } | null {
  const rooms = roomsOf(level);
  if (rooms === null) return solvePushOptimal(level);
  let player = level.player;
  let pushes = 0;
  let moves = '';
  for (const room of rooms) {
    const wall = level.wall.slice();
    for (const other of rooms) if (other !== room) for (const b of other.done ? other.goals : other.boxes) wall[b] = 1;
    const sub: Level = {
      w: level.w,
      h: level.h,
      wall,
      goals: room.goals.slice().sort((a, b) => a - b),
      boxes: room.boxes.slice().sort((a, b) => a - b),
      player,
    };
    const solved = solvePushOptimal(sub) ?? solvePushOptimal(sub, MAX_STATES * 3, false);
    if (solved === null) return null;
    pushes += solved.pushes;
    moves += solved.moves;
    player = endOf(level.w, player, solved.moves);
    room.done = true;
  }
  return { pushes, moves };
}

/** The moves for a level in XSB: a string of u, d, l and r (an upper letter marks a push; case is not checked). */
function solve(text: string): string {
  const level = parseLevel(text);
  if (level.boxes.length === 0) return '';
  // Room by room first; the whole board as a last resort, so one stubborn room never zeroes the level.
  const solved = solveByRooms(level) ?? solvePushOptimal(level, MAX_STATES * 3, false);
  return solved === null ? '' : solved.moves;
}

for (const id of readdirSync(I).sort()) {
  let moves = '';
  try {
    moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  } catch {
    moves = '';
  }
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
