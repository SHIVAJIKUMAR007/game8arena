import { Link } from 'react-router-dom'
import Seo from '../seo/Seo'

export default function About() {
  return (
    <article className="prose">
      <Seo
        title="About"
        description="Meet Shivaji Kumar, the creator of Game8Arena. Learn how the browser games and guides are made, tested and updated."
        path="/about"
      />
      <h1>About Game8Arena</h1>
      <p>
        I’m Shivaji Kumar, the creator and operator of Game8Arena. I built the site for people who want a puzzle or arcade game they can open in a browser and start playing without installing a separate app. The catalogue includes short logic challenges, arcade games and multiplayer options. You can browse the <Link to="/">game catalogue</Link> to see what is currently available.
      </p>
      <p>
        Game8Arena is a web project built with React and JavaScript. Individual games have their own rules and controls, while the site shares navigation, layouts and reusable interface pieces. Most games run directly in a modern browser. Control methods vary by game, so check the game page for keyboard, mouse or touch support before you start.
      </p>
      <h2>How games are built and tested</h2>
      <p>
        Each game’s rules are implemented in its own code, and changes are checked against the way the game is meant to play. The project includes automated tests for shared features and selected game mechanics. Test coverage differs between games, and automated checks cannot cover every device, browser or sequence of player actions. If you find a problem that the tests did not catch, please send the game name, the steps you took, and your device and browser details.
      </p>
      <h2>How the blog is written</h2>
      <p>
        I write the Game8Arena blog posts. Guides focus on the rules, controls and decisions in games available on the site, with links to the relevant game when there is a direct match. I check game-specific instructions against the current game and revise them when controls or rules change. There is no separate editorial team or independent fact-checking desk, so readers should use a publisher’s own source for claims about outside games, releases or services.
      </p>
      <p>
        The blog exists to help players understand a game before they open it, and to give them a useful next step when a guide covers a playable Game8Arena title. It does not promise that a guide will improve rankings or guarantee a particular result in a game. If a page is unclear or no longer matches the game, I want to hear about it.
      </p>
      <p>
        Some games save scores or progress in browser storage. The details depend on the game, and clearing site data may remove a local save. Please check the <Link to="/privacy">Privacy page</Link> for information about site-level data handling. Game8Arena does not need your password or payment details to let you play its free browser games.
      </p>
      <h2>Contact and corrections</h2>
      <p>
        For a bug report or correction, visit the <Link to="/contact">Contact page</Link>. Include the page or game, what you expected to happen, what happened instead, and any error message you saw. Please leave out passwords and other private information. You can also browse all current games from the <Link to="/">Game8Arena home page</Link>.
      </p>
    </article>
  )
}
