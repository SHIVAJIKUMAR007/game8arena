import { Component } from 'react'

// Catches render errors so one broken game never blanks the whole site.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Game crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="eb">
        <h2>Something went wrong 😵</h2>
        <p>The game hit an unexpected error. Your saved progress is safe.</p>
        <button className="lg-btn" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
  }
}
