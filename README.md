# Seismic Client

Seismic's typescript client using Viem actions

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

Optionally, you may set these variables to specify where `reth` will store its state:

- `RETH_DATA_DIR`: absolute path for all reth files & subdirectories
- `RETH_STATIC_FILES`: absolute path to store static files

See `.env.example` for more information
