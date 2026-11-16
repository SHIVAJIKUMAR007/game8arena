import LevelGameShell from '../../platform/LevelGameShell'
import SudokuBoard from './SudokuBoard'
import { config } from './config'

export default function SudokuGame(props) {
  return <LevelGameShell gameId="sudoku" title="Sudoku" config={config} Board={SudokuBoard} {...props} />
}
