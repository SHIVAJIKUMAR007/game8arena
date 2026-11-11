import { Link } from 'react-router-dom'
import { games } from '../data/games'
import Seo from '../seo/Seo'
import { landingPath } from '../seo/site'

export default function About() {
  return (
    <article className="prose">
      <Seo
        title="About"
        description="Game8Arena makes quick, free puzzle and arcade games you can play in your browser on phone or desktop. No download, no account, no ads."
        path="/about"
      />
      <h1>About Game8Arena</h1>
      <p>
        Quick, free puzzle and arcade games you can play in your browser, on phone or desktop. New levels, a daily challenge and achievements in
        every game.
      </p>
      <h2>What makes Game8Arena different</h2>
      <p>
        No download, no sign-up and no ads. Games load instantly, work offline once installed, and save your progress on your own device. Every
        game supports touch, mouse and keyboard.
      </p>
      <h2>Our games</h2>
      <ul className="home-links">
        {games.map(g => (
          <li key={g.id}>
            <Link to={landingPath(g.id)}>{g.emoji} <b>{g.title}</b></Link> — {g.description}
          </li>
        ))}
      </ul>
    </article>
  )
}
