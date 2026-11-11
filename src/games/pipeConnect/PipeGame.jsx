import LevelGameShell from '../../platform/LevelGameShell'
import PipeBoard from './PipeBoard'
import { config } from './config'

export default function PipeGame(props) {
  return <LevelGameShell gameId="pipe" title="Pipe Connect" config={config} Board={PipeBoard} {...props} />
}
