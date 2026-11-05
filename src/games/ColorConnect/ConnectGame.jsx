import LevelGameShell from '../../platform/LevelGameShell'
import ConnectBoard from './ConnectBoard'
import { config } from './config'

export default function ConnectGame(props) {
  return <LevelGameShell gameId="connect" title="Color Connect" config={config} Board={ConnectBoard} {...props} />
}
