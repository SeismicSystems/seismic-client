const args = process.argv.slice(2) // Skip 'node' and script path

let rpcUrl = ''
let privateKey = ''

args.forEach((arg) => {
  if (arg.startsWith('--rpc=')) {
    rpcUrl = arg.split('=')[1]
  } else if (arg.startsWith('--sk=')) {
    privateKey = arg.split('=')[1]
  }
})

if (!rpcUrl || !privateKey) {
  console.error('Error: Missing required arguments --rpc and/or --sk')
  process.exit(1) // Exit with failure
}

console.log(`RPC URL: ${rpcUrl}`)
console.log(`Private Key: ${privateKey}`)

// You can now use `rpcUrl` and `privateKey` in your application logic
