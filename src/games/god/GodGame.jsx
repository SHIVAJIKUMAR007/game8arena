import LevelGameShell from '../../platform/LevelGameShell'
import GodBoard from './GodBoard'
import { config } from './config'

export default function GodGame(props) {
  return <LevelGameShell gameId="god" title="Find God" config={config} Board={GodBoard} {...props} />
}
