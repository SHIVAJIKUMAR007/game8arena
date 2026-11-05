import LevelGameShell from '../../platform/LevelGameShell'
import BoxBoard from './BoxBoard'
import { config } from './config'

export default function BoxGame(props) {
  return <LevelGameShell gameId="box" title="Box Escape" config={config} Board={BoxBoard} {...props} />
}
