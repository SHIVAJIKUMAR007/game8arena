import Seo from '../seo/Seo'

const EMAIL = 'official.shivaji007@gmail.com'

export default function Contact() {
  return (
    <article className="prose">
      <Seo
        title="Contact Us"
        description="Contact Game8Arena operator Shivaji Kumar with feedback, bug reports, game suggestions, privacy questions or business enquiries."
        path="/contact"
      />
      <h1>Contact us</h1>
      <p>
        Game8Arena is run by Shivaji Kumar. For feedback, bug reports, game suggestions, privacy questions or business enquiries, email{' '}
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
      <p>This is the current contact address. A Game8Arena domain mailbox is not active yet.</p>
      <h2>What to include</h2>
      <ul>
        <li>For a bug: the game, the level, your device and browser, and what went wrong.</li>
        <li>For a suggestion: what you’d like to see and why.</li>
        <li>For privacy questions: see our <a href="/privacy">Privacy page</a> first, then write to us.</li>
      </ul>
    </article>
  )
}
