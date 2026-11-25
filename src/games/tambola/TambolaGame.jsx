import LevelGameShell from '../../platform/LevelGameShell'
import TambolaBoard from './TambolaBoard'
import { config } from './config'

export default function TambolaGame(props) {
  return <LevelGameShell gameId="tambola" title="Tambola" config={config} Board={TambolaBoard} {...props} />
}
