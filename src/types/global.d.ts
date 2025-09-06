// src/types/global.d.ts

// This file is used to declare types for global variables, specifically for what we attach to `globalThis`.
// This allows TypeScript's strict type checker to understand the shape of our global singleton store
// without us having to disable type checks.

// Define the shape of the data stored for each token.
// This should match the `TokenData` interface in `token-store.ts`.
interface TokenData {
  cookie: string;
  expires: number;
}

declare global {
  // We are telling TypeScript that the `globalThis` object *might* have a property
  // called `tempTokenStore`. This variable is used inside `token-store.ts` to ensure
  // a single instance of the store exists across module reloads in development
  // or serverless environments.
  //
  // By defining it here, the TypeScript compiler will no longer complain about
  // an implicit 'any' type when `globalThis.tempTokenStore` is accessed.
  var tempTokenStore: Map<string, TokenData> | undefined;
}

// This export statement is crucial. It turns this file into a module,
// which is required for the `declare global` block to be applied correctly
// to the global scope of your project. Do not remove it.
export {};

