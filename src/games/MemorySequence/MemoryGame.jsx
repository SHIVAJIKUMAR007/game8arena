import LevelGameShell from '../../platform/LevelGameShell'
import MemoryBoard from './MemoryBoard'
import { config } from './config'

export default function MemoryGame(props) {
  return <LevelGameShell gameId="memory" title="Memory Sequence" config={config} Board={MemoryBoard} {...props} />
}
