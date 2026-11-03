import LevelGameShell from '../../platform/LevelGameShell'
import ArrowBoard from './ArrowBoard'
import { config } from './config'

export default function ArrowGame(props) {
  return <LevelGameShell gameId="arrow" title="Arrow Escape" config={config} Board={ArrowBoard} {...props} />
}
