# Seismic Client

Seismic's typescript client. This repository contains:

- [seismic-viem](packages/seismic-viem), a set of extensions for [viem](https://viem.sh/)
- [seismic-react](packages/seismic-react), a set of React hooks compatible with [wagmi](https://wagmi.sh/)

## Docs

View the docs [here](https://seismic-docs.netlify.app)

## Install

### nvm

Install [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)

Using [brew](https://formulae.brew.sh/formula/nvm):
`brew install nvm`

Make sure to follow the instructions to will source `nvm` in your shell profile

### npm

Install `npm` with node `23.3.0` using `nvm`:

```sh
nvm install 23.3.0
nvm use 23.3.0
```

### bun

Install the latest [bun](https://bun.sh/docs/installation). Using curl:

```sh
curl -fsSL https://bun.sh/install | bash
```

## Running tests

### Create a `.env` file

Create a `.env` file in the repo root. These variables are only used for running tests. This file should have:

- `SRETH_ROOT`: the path to your local `seismic-reth` directory
- `SFOUNDRY_ROOT`: the path to your local `seismic-foundry` directory

Optionally, you may set these variables to specify where `reth` will store its state:

- `RETH_DATA_DIR`: absolute path for all reth files & subdirectories
- `RETH_STATIC_FILES`: absolute path to store static files

See `.env.example` for more information


    "seismic-viem": "1.0.27-experimental.1",
    "seismic-react": "1.0.27-experimental.1",
    "viem": "2.x",
    "wagmi": "2.x",
    "@privy-io/react-auth": "^2.6.2",
    "@privy-io/wagmi": "^1.0.3",
    "@rainbow-me/rainbowkit": "^2.2.4",
    "@tanstack/react-query": "^5.67.3",
    "@walletconnect/ethereum-provider": "^2.19.1"
