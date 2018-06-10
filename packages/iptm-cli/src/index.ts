#!/usr/bin/env node
// tslint:disable
// tslint:enable prettier
import * as program from 'commander'
import { compress } from './compress'
import { decompress } from './decompress'

program
  .command('compress [file]')
  .description('compress a file and store it in ipfs, returning the root hash')
  .option(
    '--api <string>',
    'ipfs api to use. defaults to http://localhost:5001. No trailing slashes!',
  )
  .option('-v, --verbose', 'verbosity level', (_v, total) => total + 1, 0)
  .action((file, cmd) => {
    const verbose: number = cmd.verbose || 0
    const api: string = cmd.api || 'http://localhost:5001'
    const abort = () => {
      console.log('interactive input not supported')
      program.outputHelp()
      return process.exit(4)
    }
    compress({ api, verbose, file, abort })
  })

program
  .command('decompress <hash>')
  .description('decompresses data from ipfs given a root hash')
  .option(
    '--api <string>',
    'ipfs api to use. defaults to http://localhost:5001. No trailing slashes!',
  )
  .option('--compact', 'compact json output')
  .option('-v, --verbose', 'verbosity level', (_v, total) => total + 1, 0)
  .action((hash, cmd) => {
    const verbose: number = cmd.verbose || 0
    const api: string = cmd.api || 'http://localhost:5001'
    const compact: boolean = cmd.compact || false
    decompress({ hash, verbose, api, compact })
  })

program.parse(process.argv)
