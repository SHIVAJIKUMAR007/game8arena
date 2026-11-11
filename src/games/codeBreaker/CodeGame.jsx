import LevelGameShell from '../../platform/LevelGameShell'
import CodeBoard from './CodeBoard'
import { config } from './config'

export default function CodeGame(props) {
  return <LevelGameShell gameId="code" title="Code Breaker" config={config} Board={CodeBoard} {...props} />
}
