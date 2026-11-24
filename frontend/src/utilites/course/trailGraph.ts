import {haversine, LatLng, selfCrossings} from "./geo.ts";

// Loops planned on the trails themselves, for « Sentiers »: the trails around the start (from
// OpenStreetMap) become a network, short street links join its pieces, and loops of the asked length
// are searched on it before BRouter routes any of them. A shape drawn around the start can't do this:
// in a small park, every corner of the shape lands in the streets around it.

export interface TrailWay {
    points: LatLng[];
    // How much it feels like a trail, 0 to 1 (see natureOf in routing.ts).
    nature: number;
}

export interface PlannedLoop {
    // The loop's line, from the start back to it.
    points: LatLng[];
    // For each stretch points[i] → points[i + 1]: false when it is a street link between trails.
    onTrail: boolean[];
    length: number;
    nature: number;
    // The share of the length run a second time.
    reuse: number;
    // The points for BRouter to go through so that it follows the loop (see marksFor).
    marks: LoopMark[];
}

export interface LoopMark {
    along: number;
    point: LatLng;
    // For a stretch BRouter left out: how long it is.
    missed?: number;
}

// A street link between two trails: how far one may be, and how much it counts.
const LINK_NATURE = 0.1;
const LINK_DETOUR = 1.3;
const COMPONENT_LINK_M = 200;
const DEAD_END_LINK_M = 120;
const START_LINK_MAX_M = 1500;
// Bits of path shorter than this (a crossing, a few metres by a parking lot) are left out.
const MIN_PIECE_M = 150;
// Running a stretch twice costs this many times more than finding another way.
const REUSE_PENALTY = 6;
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const MAX_GAP = 0.25;
const WALKS = 400;
// Two loops sharing more of their length are the same loop; one scoring this much worse isn't shown.
const MAX_OVERLAP = 0.7;
const MAX_BEHIND = 0.3;
const SAME_LOOP = 0.9;
const SHORTLIST = 20;
const MARKS_PER_KM = 1.2;
const MARK_COST = 0.01;
const CROSSING_COST = 0.02;

interface Graph {
    pos: LatLng[];
    x: number[];
    y: number[];
    adj: number[][];
    ea: number[];
    eb: number[];
    length: number[];
    nature: number[];
    link: boolean[];
}

const costOf = (g: Graph, e: number) => g.length[e] * (1 + 3 * (1 - g.nature[e]));
const otherEnd = (g: Graph, e: number, n: number) => (g.ea[e] === n ? g.eb[e] : g.ea[e]);

class MinHeap {
    private keys: number[] = [];
    private values: number[] = [];

    get size() {
        return this.keys.length;
    }

    push(key: number, value: number) {
        const keys = this.keys;
        const values = this.values;
        let i = keys.length;
        keys.push(key);
        values.push(value);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (keys[parent] <= key) {
                break;
            }
            keys[i] = keys[parent];
            values[i] = values[parent];
            i = parent;
        }
        keys[i] = key;
        values[i] = value;
    }

    pop(): [number, number] {
        const keys = this.keys;
        const values = this.values;
        const top: [number, number] = [keys[0], values[0]];
        const lastKey = keys.pop() as number;
        const lastValue = values.pop() as number;
        if (keys.length > 0) {
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                if (left >= keys.length) {
                    break;
                }
                const child = left + 1 < keys.length && keys[left + 1] < keys[left] ? left + 1 : left;
                if (keys[child] >= lastKey) {
                    break;
                }
                keys[i] = keys[child];
                values[i] = values[child];
                i = child;
            }
            keys[i] = lastKey;
            values[i] = lastValue;
        }
        return top;
    }
}

interface Tree {
    cost: Float64Array;
    length: Float64Array;
    via: Int32Array;
}

const boundedFrom = (g: Graph, source: number, maxLength: number): Tree => {
    const n = g.pos.length;
    const cost = new Float64Array(n).fill(Infinity);
    const length = new Float64Array(n).fill(Infinity);
    const via = new Int32Array(n).fill(-1);
    const heap = new MinHeap();
    cost[source] = 0;
    length[source] = 0;
    heap.push(0, source);
    while (heap.size > 0) {
        const [c, u] = heap.pop();
        if (c > cost[u]) {
            continue;
        }
        for (const e of g.adj[u]) {
            const v = otherEnd(g, e, u);
            const next = c + costOf(g, e);
            const nextLength = length[u] + g.length[e];
            if (next < cost[v] && nextLength <= maxLength) {
                cost[v] = next;
                length[v] = nextLength;
                via[v] = e;
                heap.push(next, v);
            }
        }
    }

    return {cost, length, via};
};

// The ways, without the pieces of network too short to run on.
const withoutScraps = (ways: TrailWay[]): TrailWay[] => {
    const key = (p: LatLng) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
    const parent = ways.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    const wayAt = new Map<string, number>();
    ways.forEach((way, i) => {
        for (const p of way.points) {
            const other = wayAt.get(key(p));
            if (other === undefined) {
                wayAt.set(key(p), i);
            } else {
                parent[find(i)] = find(other);
            }
        }
    });
    const lengths = new Map<number, number>();
    ways.forEach((way, i) => {
        let length = 0;
        for (let k = 1; k < way.points.length; k++) {
            length += haversine(way.points[k - 1], way.points[k]);
        }
        lengths.set(find(i), (lengths.get(find(i)) ?? 0) + length);
    });

    return ways.filter((_, i) => (lengths.get(find(i)) ?? 0) >= MIN_PIECE_M);
};

const buildGraph = (allWays: TrailWay[], start: LatLng): { g: Graph; s: number } | null => {
    const ways = withoutScraps(allWays);
    const lat0 = start.lat;
    const cos0 = Math.cos((lat0 * Math.PI) / 180);
    const g: Graph = {pos: [], x: [], y: [], adj: [], ea: [], eb: [], length: [], nature: [], link: []};
    const index = new Map<string, number>();
    const node = (p: LatLng) => {
        const key = `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`;
        let id = index.get(key);
        if (id === undefined) {
            id = g.pos.length;
            index.set(key, id);
            g.pos.push(p);
            g.x.push((p.lng - start.lng) * cos0 * 111320);
            g.y.push((p.lat - lat0) * 110540);
            g.adj.push([]);
        }
        return id;
    };
    const addEdge = (a: number, b: number, length: number, nature: number, link: boolean) => {
        const id = g.ea.length;
        g.ea.push(a);
        g.eb.push(b);
        g.length.push(length);
        g.nature.push(nature);
        g.link.push(link);
        g.adj[a].push(id);
        g.adj[b].push(id);
    };
    const distance = (a: number, b: number) => Math.hypot(g.x[a] - g.x[b], g.y[a] - g.y[b]);

    for (const way of ways) {
        for (let i = 1; i < way.points.length; i++) {
            const a = node(way.points[i - 1]);
            const b = node(way.points[i]);
            if (a !== b) {
                addEdge(a, b, distance(a, b), way.nature, false);
            }
        }
    }
    const count = g.pos.length;
    if (count < 2) {
        return null;
    }

    // The separate pieces of the network (a trail ends at a street, the next one starts across it).
    const parent = Array.from({length: count}, (_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    for (let e = 0; e < g.ea.length; e++) {
        parent[find(g.ea[e])] = find(g.eb[e]);
    }
    const piece = Array.from({length: count}, (_, i) => find(i));

    const cell = COMPONENT_LINK_M;
    const grid = new Map<string, number[]>();
    for (let i = 0; i < count; i++) {
        const key = `${Math.floor(g.x[i] / cell)},${Math.floor(g.y[i] / cell)}`;
        const list = grid.get(key);
        if (list) {
            list.push(i);
        } else {
            grid.set(key, [i]);
        }
    }
    const near = (i: number, radius: number, visit: (j: number, d: number) => void) => {
        const cx = Math.floor(g.x[i] / cell);
        const cy = Math.floor(g.y[i] / cell);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
                    const d = distance(i, j);
                    if (j !== i && d <= radius) {
                        visit(j, d);
                    }
                }
            }
        }
    };
    const link = (a: number, b: number, d: number) => addEdge(a, b, d * LINK_DETOUR, LINK_NATURE, true);

    // The closest points of every two pieces near each other: the street between them.
    const closest = new Map<string, { a: number; b: number; d: number }>();
    for (let i = 0; i < count; i++) {
        near(i, COMPONENT_LINK_M, (j, d) => {
            if (piece[i] < piece[j]) {
                const key = `${piece[i]},${piece[j]}`;
                const best = closest.get(key);
                if (!best || d < best.d) {
                    closest.set(key, {a: i, b: j, d});
                }
            }
        });
    }
    for (const {a, b, d} of closest.values()) {
        link(a, b, d);
    }

    // A trail that stops at a street often goes on across it, from the same piece.
    for (let i = 0; i < count; i++) {
        if (g.adj[i].length !== 1) {
            continue;
        }
        let target = -1;
        let targetD = Infinity;
        near(i, DEAD_END_LINK_M, (j, d) => {
            if (piece[j] === piece[i] && d < targetD) {
                target = j;
                targetD = d;
            }
        });
        if (target >= 0) {
            const around = boundedFrom(g, i, 4 * targetD + 60);
            if (around.length[target] === Infinity) {
                link(i, target, targetD);
            }
        }
    }

    // The start joins the nearest trail, and the nearest point of other pieces about as close.
    const s = node(start);
    const nearestOf = new Map<number, { j: number; d: number }>();
    for (let j = 0; j < count; j++) {
        const d = distance(s, j);
        const best = nearestOf.get(piece[j]);
        if (!best || d < best.d) {
            nearestOf.set(piece[j], {j, d});
        }
    }
    const byDistance = [...nearestOf.values()].sort((a, b) => a.d - b.d);
    if (byDistance.length === 0 || byDistance[0].d > START_LINK_MAX_M) {
        return null;
    }
    const reach = Math.min(START_LINK_MAX_M, byDistance[0].d * 2 + 150);
    for (const {j, d} of byDistance.slice(0, 4)) {
        if (d <= reach) {
            link(s, j, d);
        }
    }

    return {g, s};
};

// The network between its forks: each stretch between two forks (or ends) is one chain of edges. The
// searches run on the forks and chains, far fewer than the nodes and edges.
interface Chain {
    // Its two ends, as fork numbers.
    a: number;
    b: number;
    edges: number[];
    length: number;
    cost: number;
    nature: number;
    // The heading leaving a, and arriving at b.
    out: number;
    in: number;
}

interface Network {
    chains: Chain[];
    // The chains at each fork, and which way they run from it.
    at: { chain: number; forward: boolean }[][];
    forks: number[];
    forkOf: Int32Array;
}

const headingOf = (g: Graph, from: number, to: number) => (
    (Math.atan2(g.x[to] - g.x[from], g.y[to] - g.y[from]) * 180 / Math.PI + 360) % 360
);

const networkOf = (g: Graph, s: number): Network => {
    const forks: number[] = [];
    const forkOf = new Int32Array(g.pos.length).fill(-1);
    for (let n = 0; n < g.pos.length; n++) {
        if (n === s || g.adj[n].length !== 2) {
            forkOf[n] = forks.length;
            forks.push(n);
        }
    }
    const seen = new Uint8Array(g.ea.length);
    const chains: Chain[] = [];
    const at: Network['at'] = forks.map(() => []);
    // A few tens of metres along, for a heading that isn't thrown off by the first few nodes.
    const headingAlong = (nodes: number[]) => {
        let k = 1;
        while (k < nodes.length - 1 && Math.hypot(g.x[nodes[k]] - g.x[nodes[0]], g.y[nodes[k]] - g.y[nodes[0]]) < 30) {
            k++;
        }
        return headingOf(g, nodes[0], nodes[k]);
    };
    for (const start of forks) {
        for (const first of g.adj[start]) {
            if (seen[first]) {
                continue;
            }
            const edges = [first];
            const nodes = [start];
            seen[first] = 1;
            let current = otherEnd(g, first, start);
            nodes.push(current);
            while (forkOf[current] < 0) {
                const next = g.adj[current][0] === edges[edges.length - 1] ? g.adj[current][1] : g.adj[current][0];
                if (seen[next]) {
                    break;
                }
                seen[next] = 1;
                edges.push(next);
                current = otherEnd(g, next, current);
                nodes.push(current);
            }
            if (forkOf[current] < 0) {
                continue;
            }
            let length = 0;
            let cost = 0;
            let nature = 0;
            for (const e of edges) {
                length += g.length[e];
                cost += costOf(g, e);
                nature += g.length[e] * g.nature[e];
            }
            const id = chains.length;
            const a = forkOf[start];
            const b = forkOf[current];
            chains.push({
                a,
                b,
                edges,
                length,
                cost,
                nature: length > 0 ? nature / length : 0,
                out: headingAlong(nodes),
                in: (headingAlong([...nodes].reverse()) + 180) % 360,
            });
            at[a].push({chain: id, forward: true});
            if (b !== a) {
                at[b].push({chain: id, forward: false});
            }
        }
    }

    return {chains, at, forks, forkOf};
};

interface Step {
    chain: number;
    forward: boolean;
}

// The cheapest ways from one fork to all the others; a penalty multiplies the cost of each chain.
const cheapestFrom = (net: Network, source: number, penalty?: Float64Array): Tree => {
    const count = net.forks.length;
    const cost = new Float64Array(count).fill(Infinity);
    const length = new Float64Array(count).fill(Infinity);
    const via = new Int32Array(count).fill(-1);
    const heap = new MinHeap();
    cost[source] = 0;
    length[source] = 0;
    heap.push(0, source);
    while (heap.size > 0) {
        const [c, u] = heap.pop();
        if (c > cost[u]) {
            continue;
        }
        for (const {chain: id, forward} of net.at[u]) {
            const chain = net.chains[id];
            const v = forward ? chain.b : chain.a;
            const next = c + chain.cost * (penalty ? penalty[id] : 1);
            if (next < cost[v]) {
                cost[v] = next;
                length[v] = length[u] + chain.length;
                via[v] = id;
                heap.push(next, v);
            }
        }
    }

    return {cost, length, via};
};

// The cheapest ways to every fork, from forks already this far: BRouter's way with our profile.
const shortestFrom = (net: Network, sources: [number, number][]): Float64Array => {
    const length = new Float64Array(net.forks.length).fill(Infinity);
    const heap = new MinHeap();
    for (const [fork, already] of sources) {
        if (already < length[fork]) {
            length[fork] = already;
            heap.push(already, fork);
        }
    }
    while (heap.size > 0) {
        const [d, u] = heap.pop();
        if (d > length[u]) {
            continue;
        }
        for (const {chain: id, forward} of net.at[u]) {
            const chain = net.chains[id];
            const v = forward ? chain.b : chain.a;
            if (d + chain.cost < length[v]) {
                length[v] = d + chain.cost;
                heap.push(length[v], v);
            }
        }
    }

    return length;
};

const stepsTo = (net: Network, tree: Tree, target: number): Step[] => {
    const steps: Step[] = [];
    for (let n = target; tree.via[n] >= 0;) {
        const chain = net.chains[tree.via[n]];
        const forward = chain.b === n && chain.a !== n;
        steps.push({chain: tree.via[n], forward});
        n = forward ? chain.a : chain.b;
    }

    return steps.reverse();
};

const edgesOf = (net: Network, steps: Step[]): number[] => steps.flatMap(({chain, forward}) => (
    forward ? net.chains[chain].edges : [...net.chains[chain].edges].reverse()
));

// A small seeded random generator: the same start gives the same proposals.
const randomFrom = (seed: number) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const angleBetween = (a: number, b: number) => {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
};

const toLoop = (g: Graph, s: number, edges: number[]): PlannedLoop => {
    const points: LatLng[] = [g.pos[s]];
    const onTrail: boolean[] = [];
    const uses = new Map<number, number>();
    let length = 0;
    let nature = 0;
    let reused = 0;
    let at = s;
    for (const e of edges) {
        at = otherEnd(g, e, at);
        points.push(g.pos[at]);
        onTrail.push(!g.link[e]);
        length += g.length[e];
        nature += g.length[e] * g.nature[e];
        const used = uses.get(e) ?? 0;
        if (used > 0) {
            reused += g.length[e];
        }
        uses.set(e, used + 1);
    }

    return {points, onTrail, length, nature: length > 0 ? nature / length : 0, reuse: length > 0 ? reused / length : 0, marks: []};
};

const edgeOverlap = (a: Set<number>, b: Set<number>, g: Graph) => {
    let shared = 0;
    let total = 0;
    for (const e of a) {
        total += g.length[e];
        if (b.has(e)) {
            shared += g.length[e];
        }
    }
    return total > 0 ? shared / total : 0;
};

// BRouter takes the cheapest way between two points it is given: a loop winding through a dense park
// needs a point each time it leaves the cheapest way, one is enough along a long trail. Going along the
// loop, a point goes in the middle of the first chain that makes the way since the last point dearer
// than the cheapest one.
const SHORTEST_SLACK = 1.05;
const SHORTEST_SLACK_M = 20;

const marksFor = (net: Network, s: number, loop: PlannedLoop, steps: Step[]): LoopMark[] => {
    const along = alongOf(loop.points);
    // Where each step starts, in the loop's points, and at which fork.
    const firstPoint: number[] = [0];
    const forkAt: number[] = [s];
    // What the loop costs from its start to each step.
    const costAt: number[] = [0];
    let fork = s;
    for (const {chain, forward} of steps) {
        firstPoint.push(firstPoint[firstPoint.length - 1] + net.chains[chain].edges.length);
        costAt.push(costAt[costAt.length - 1] + net.chains[chain].cost);
        fork = forward ? net.chains[chain].b : net.chains[chain].a;
        forkAt.push(fork);
    }
    // Near the middle of a step, where both stretches around the point are on a trail.
    const middleOf = (step: number): (LoopMark & { index: number }) | null => {
        const from = firstPoint[step];
        const to = firstPoint[step + 1];
        const middle = (along[from] + along[to]) / 2;
        let best = -1;
        for (let i = from + 1; i < to; i++) {
            if (loop.onTrail[i - 1] && loop.onTrail[i] && (best < 0 || Math.abs(along[i] - middle) < Math.abs(along[best] - middle))) {
                best = i;
            }
        }
        if (best < 0 && from > 0 && loop.onTrail[from - 1] && loop.onTrail[from]) {
            best = from;
        }
        return best < 0 ? null : {along: along[best], point: loop.points[best], index: best};
    };

    // From the last point, BRouter may go on, or back along the chain it sits on.
    const marks: LoopMark[] = [];
    let from = 0;
    let sources: [number, number][] = [[s, 0]];
    let startCost = 0;
    while (from < steps.length) {
        const cheapest = shortestFrom(net, sources);
        let to = from + 1;
        while (to <= steps.length && costAt[to] - startCost <= SHORTEST_SLACK * cheapest[forkAt[to]] + SHORTEST_SLACK_M) {
            to++;
        }
        if (to > steps.length) {
            break;
        }
        const step = to - 1;
        const mark = middleOf(step);
        if (mark) {
            marks.push({along: mark.along, point: mark.point});
            // The chain's cost on either side of the point, in proportion to its length.
            const span = along[firstPoint[step + 1]] - along[firstPoint[step]] || 1;
            const before = (net.chains[steps[step].chain].cost * (mark.along - along[firstPoint[step]])) / span;
            const after = net.chains[steps[step].chain].cost - before;
            sources = [[forkAt[step + 1], after], [forkAt[step], before]];
            startCost = costAt[step] + before;
        } else {
            sources = [[forkAt[step + 1], 0]];
            startCost = costAt[step + 1];
        }
        from = to;
    }

    return marks;
};

/** Loops close to `targetM` on the trails around `start`, the best first; empty when there are too few trails. */
export const planLoops = (ways: TrailWay[], start: LatLng, targetM: number, max = 6): PlannedLoop[] => {
    const built = buildGraph(ways, start);
    if (!built) {
        return [];
    }
    const {g} = built;
    const net = networkOf(g, built.s);
    const {chains, at, forks} = net;
    const s = net.forkOf[built.s];
    const fromStart = cheapestFrom(net, s);

    const candidates: { loop: PlannedLoop; steps: Step[]; edges: Set<number>; value: number }[] = [];
    const consider = (steps: Step[]) => {
        const edges = edgesOf(net, steps);
        if (edges.length === 0) {
            return null;
        }
        const loop = toLoop(g, built.s, edges);
        const gap = Math.abs(loop.length - targetM) / targetM;
        if (gap <= MAX_GAP) {
            candidates.push({loop, steps, edges: new Set(edges), value: gap + 0.6 * loop.reuse + 0.5 * (1 - loop.nature)});
        }
        return loop;
    };

    // Where a loop turns: the forks and ends of trails, with their way from the start and its heading.
    const turns: { n: number; length: number; heading: number }[] = [];
    for (let n = 0; n < forks.length; n++) {
        if (n !== s && fromStart.length[n] < Infinity) {
            turns.push({n, length: fromStart.length[n], heading: headingOf(g, built.s, forks[n])});
        }
    }
    if (turns.length === 0) {
        return [];
    }
    const turnNear = (length: number, heading: number) => {
        let best = turns[0];
        let bestValue = Infinity;
        for (const turn of turns) {
            const value = Math.abs(turn.length - length) / length + 0.6 * angleBetween(turn.heading, heading) / 180;
            if (value < bestValue) {
                bestValue = value;
                best = turn;
            }
        }
        return best.n;
    };

    // A loop through the given turns, in order: each leg avoids the chains the ones before ran on.
    const loopThrough = (via: number[]): Step[] => {
        const penalty = new Float64Array(chains.length).fill(1);
        const steps: Step[] = [];
        let from = s;
        for (const target of [...via, s]) {
            if (target === from) {
                continue;
            }
            const tree = steps.length === 0 ? fromStart : cheapestFrom(net, from, penalty);
            if (tree.cost[target] === Infinity) {
                return [];
            }
            for (const step of stepsTo(net, tree, target)) {
                steps.push(step);
                penalty[step.chain] = REUSE_PENALTY;
            }
            from = target;
        }
        return steps;
    };

    // Each way of turning, grown or shrunk until the loop it gives is about the length asked for.
    const tryShape = (turnsFor: (scale: number) => number[], firstScale: number) => {
        let scale = firstScale;
        for (let i = 0; i < 3; i++) {
            const loop = consider(loopThrough(turnsFor(scale)));
            if (!loop || loop.length === 0 || Math.abs(loop.length - targetM) / targetM < 0.03) {
                break;
            }
            scale *= Math.min(1.6, Math.max(0.6, targetM / loop.length));
        }
    };
    for (const heading of BEARINGS) {
        // Out to one turn and back another way…
        tryShape((scale) => [turnNear(scale, heading)], targetM * 0.38);
        // …or out to one, across to a second, and back.
        for (const side of [70, -70]) {
            tryShape((scale) => [turnNear(scale, heading), turnNear(scale, (heading + side + 360) % 360)], targetM / 3.3);
        }
    }

    // Shapes reach far: in a park smaller than the loop, they leave it. Walks from fork to fork, on
    // trails not run yet and going on rather than turning back, stay where the trails are and wind
    // through them until the length is there, then take the best way back.
    const random = randomFrom(Math.round(start.lat * 1e5) ^ Math.round(start.lng * 1e5) ^ Math.round(targetM));
    const penalty = new Float64Array(chains.length);
    for (let walk = 0; walk < WALKS; walk++) {
        penalty.fill(1);
        const steps: Step[] = [];
        let node = s;
        let length = 0;
        let heading = -1;
        let incoming = -1;
        while (length + fromStart.length[node] < targetM * 0.97) {
            const options = at[node].filter((o) => o.chain !== incoming || at[node].length === 1);
            let total = 0;
            const weights = options.map((o) => {
                const chain = chains[o.chain];
                const end = o.forward ? chain.b : chain.a;
                if (length + chain.length + fromStart.length[end] > targetM * 1.08) {
                    return 0;
                }
                const leaving = o.forward ? chain.out : (chain.in + 180) % 360;
                const turn = heading < 0 ? 1 : 0.1 + 0.9 * ((1 + Math.cos(angleBetween(heading, leaving) * Math.PI / 180)) / 2) ** 2;
                // A trail that ends nowhere is run there and back.
                const deadEnd = end !== s && at[end].length === 1 ? 0.03 : 1;
                const weight = (penalty[o.chain] > 1 ? 0.04 : 1) * deadEnd * (0.15 + chain.nature) ** 2 * turn;
                total += weight;
                return weight;
            });
            if (total === 0) {
                break;
            }
            let pick = random() * total;
            let choice = 0;
            while (pick > weights[choice] && choice < options.length - 1) {
                pick -= weights[choice];
                choice++;
            }
            const {chain: id, forward} = options[choice];
            const chain = chains[id];
            penalty[id] = REUSE_PENALTY;
            steps.push({chain: id, forward});
            length += chain.length;
            node = forward ? chain.b : chain.a;
            heading = forward ? chain.in : (chain.out + 180) % 360;
            incoming = id;
        }
        if (steps.length === 0) {
            continue;
        }
        // The way back, avoiding what the walk already ran on.
        if (node !== s) {
            const back = cheapestFrom(net, node, penalty);
            if (back.cost[s] === Infinity) {
                continue;
            }
            steps.push(...stepsTo(net, back, s));
        }
        consider(steps);
    }

    // The best ones, different enough from each other, and none far behind the best. A loop that
    // needs many points to be followed is hard to edit and to mark on the ground: it counts against it,
    // and so does a loop crossing itself again and again.
    const shortlist: (typeof candidates[number] & { marks: LoopMark[] })[] = [];
    for (const candidate of candidates.sort((a, b) => a.value - b.value)) {
        if (shortlist.length >= SHORTLIST || candidate.value > candidates[0].value + MAX_BEHIND) {
            break;
        }
        if (shortlist.every((other) => edgeOverlap(candidate.edges, other.edges, g) < SAME_LOOP)) {
            const marks = marksFor(net, s, candidate.loop, candidate.steps);
            const extra = Math.max(0, marks.length - MARKS_PER_KM * candidate.loop.length / 1000);
            // Crossing itself now and then is fine in a park; a tangle is hard to follow and to mark.
            const crossings = Math.min(10, selfCrossings(candidate.loop.points));
            shortlist.push({...candidate, marks, value: candidate.value + MARK_COST * extra + CROSSING_COST * crossings});
        }
    }
    const kept: typeof shortlist = [];
    for (const candidate of shortlist.sort((a, b) => a.value - b.value)) {
        if (kept.length < max && kept.every((other) => edgeOverlap(candidate.edges, other.edges, g) < MAX_OVERLAP)) {
            kept.push(candidate);
        }
    }

    return kept.map(({loop, marks}) => ({...loop, marks}));
};

const alongOf = (points: LatLng[]) => {
    const along = [0];
    for (let i = 1; i < points.length; i++) {
        along.push(along[i - 1] + haversine(points[i - 1], points[i]));
    }
    return along;
};

/**
 * Where the routed line leaves the planned trails for more than `minM`: the middle of each stretch
 * missed, to route through it next time, the longest first.
 */
export const missedStretches = (loop: PlannedLoop, routed: LatLng[], toleranceM = 25, minM = 60): LoopMark[] => {
    if (routed.length < 2) {
        return [];
    }
    const lat0 = routed[0].lat;
    const lng0 = routed[0].lng;
    const cos0 = Math.cos((lat0 * Math.PI) / 180);
    const xy = (p: LatLng): [number, number] => [(p.lng - lng0) * cos0 * 111320, (p.lat - lat0) * 110540];
    const cell = toleranceM;
    const grid = new Map<string, number[]>();
    // The routed line, every few metres, in a grid of cells the size of the tolerance.
    for (let i = 1; i < routed.length; i++) {
        const [ax, ay] = xy(routed[i - 1]);
        const [bx, by] = xy(routed[i]);
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
        for (let k = 0; k <= steps; k++) {
            const x = ax + ((bx - ax) * k) / steps;
            const y = ay + ((by - ay) * k) / steps;
            const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
            const list = grid.get(key);
            if (list) {
                list.push(x, y);
            } else {
                grid.set(key, [x, y]);
            }
        }
    }
    const onRoute = (p: LatLng) => {
        const [x, y] = xy(p);
        const cx = Math.floor(x / cell);
        const cy = Math.floor(y / cell);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const list = grid.get(`${cx + dx},${cy + dy}`) ?? [];
                for (let k = 0; k < list.length; k += 2) {
                    if (Math.hypot(list[k] - x, list[k + 1] - y) <= toleranceM) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const along = alongOf(loop.points);
    const marks: LoopMark[] = [];
    let missStart = -1;
    const close = (end: number) => {
        if (missStart >= 0 && along[end] - along[missStart] >= minM) {
            const middle = (along[missStart] + along[end]) / 2;
            let best = missStart;
            for (let i = missStart; i <= end; i++) {
                if (Math.abs(along[i] - middle) < Math.abs(along[best] - middle)) {
                    best = i;
                }
            }
            marks.push({along: along[best], point: loop.points[best], missed: along[end] - along[missStart]});
        }
        missStart = -1;
    };
    for (let i = 0; i < loop.points.length; i++) {
        const trail = (i > 0 && loop.onTrail[i - 1]) || (i < loop.onTrail.length && loop.onTrail[i]);
        if (trail && !onRoute(loop.points[i])) {
            if (missStart < 0) {
                missStart = i;
            }
        } else {
            close(i);
        }
    }
    close(loop.points.length - 1);

    return marks.sort((a, b) => (b.missed ?? 0) - (a.missed ?? 0));
};
