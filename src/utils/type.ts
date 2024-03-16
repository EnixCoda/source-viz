type KeyOfMap<M> = M extends Map<infer K, unknown> ? K : never;
type ValueOfMap<M> = M extends Map<unknown, infer V> ? V : never;
type ValueOf<X> = X[keyof X];

type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
