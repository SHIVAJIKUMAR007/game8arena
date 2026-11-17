import Seo from '../seo/Seo'

const EMAIL = 'official.shivaji007@gmail.com'

export default function Contact() {
  return (
    <article className="prose">
      <Seo
        title="Contact Us"
        description="Contact Game8Arena for feedback, bug reports, game suggestions, privacy questions or business enquiries. We read every email."
        path="/contact"
      />
      <h1>Contact us</h1>
      <p>
        Got feedback, found a bug, or have an idea for a new game? We’d like to hear from you. Email us at{' '}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
      <h2>What to include</h2>
      <ul>
        <li>For a bug: the game, the level, your device and browser, and what went wrong.</li>
        <li>For a suggestion: what you’d like to see and why.</li>
        <li>For privacy questions: see our <a href="/privacy">Privacy page</a> first, then write to us.</li>
      </ul>
      <p>We usually reply within a few days.</p>
    </article>
  )
}
