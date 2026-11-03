import LevelGameShell from '../../platform/LevelGameShell'
import MergeBoard from './MergeBoard'
import { config } from './config'

export default function MergeGame(props) {
  return <LevelGameShell gameId="merge" title="Merge Rush" config={config} Board={MergeBoard} {...props} />
}
