import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import GamePage from "./pages/GamePage";
import GameLanding from "./pages/GameLanding";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import ToastHost from "./platform/ui/ToastHost";
import ConsentBanner from "./platform/ui/ConsentBanner";

export default function App() {
  return (
    <div className="app">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games/:id" element={<GameLanding />} />
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      {/* Browser-only UI, left out of the prerendered HTML so it doesn't flash for returning players. */}
      {!import.meta.env.SSR && <ToastHost />}
      {!import.meta.env.SSR && <ConsentBanner />}
    </div>
  );
}
