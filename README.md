# Aurora Staking SDK

A TypeScript library that contains logic for staking and unstaking AURORA.

## Installation

```sh
yarn add @aurora-is-near/staking
```

## Usage

Wrap your application in a `StakingProvider`, for example:

```tsx
<StackingProvider
  isConnected
  network="mainnet"
>
  <p>Hello, World!</p>
</StackingProvider>
```

Then access the staking functionality via the `useStaking` hook:

```tsx
const staking = useStaking();

console.log(staking.balance) // => 1337
```
