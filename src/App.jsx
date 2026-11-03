import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import GamePage from './pages/GamePage'
import About from './pages/About'
import Privacy from './pages/Privacy'
import ToastHost from './platform/ui/ToastHost'
import ConsentBanner from './platform/ui/ConsentBanner'

export default function App() {
  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <ToastHost />
      <ConsentBanner />
    </div>
  )
}
