import PostponedSieve from 'fast-prime-gen';

// Module-level incremental prime cache shared by the whole app: the sieve only
// ever runs forward, so slider changes never regenerate primes from scratch.
const primeCache: number[] = [];
let sieveGen: Generator<number> | null = null;

// Grows the cache to at least `count` primes and returns it (may be longer).
// Callers that index into it must guard with `index < result.length`.
export const getPrimes = (count: number): number[] => {
  if (!sieveGen) sieveGen = PostponedSieve();
  while (primeCache.length < count) {
    const next = sieveGen.next();
    if (next.done) break;
    primeCache.push(next.value);
  }
  return primeCache;
};

// Exactly the first `count` primes, as a fresh array (safe to hold as React state).
export const firstPrimes = (count: number): number[] => getPrimes(count).slice(0, count);
