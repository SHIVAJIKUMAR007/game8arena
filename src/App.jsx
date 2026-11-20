import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import GamePage from "./pages/GamePage";
import GameLanding from "./pages/GameLanding";
import About from "./pages/About";
import Blogs from "./pages/Blogs";
import BlogPost from "./pages/BlogPost";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Disclaimer from "./pages/Disclaimer";
import NotFound from "./pages/NotFound";
import ConsentBanner from "./platform/ui/ConsentBanner";
import ToastHost from "./platform/ui/ToastHost";

export default function App() {
  return (
    <div className="app">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/games/:id" element={<GameLanding />} />
          <Route path="/play/:id" element={<GamePage />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:slug" element={<BlogPost />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
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
