import LevelGameShell from '../../platform/LevelGameShell'
import TrafficBoard from './TrafficBoard'
import { config } from './config'

export default function TrafficGame(props) {
  return <LevelGameShell gameId="traffic" title="Traffic Escape" config={config} Board={TrafficBoard} {...props} />
}
