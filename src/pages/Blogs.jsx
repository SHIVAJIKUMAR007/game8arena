import { Link } from "react-router-dom";
import { blogPath, blogPosts } from "../data/blogPosts";
import Seo from "../seo/Seo";
import { blogListSchema, breadcrumbSchema } from "../seo/schema";
import { formatDate } from "./BlogPost";

export default function Blogs() {
  const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="blog">
      <Seo
        title="Game8Arena Blog: Gaming News, Guides and Puzzle Tips"
        fullTitle
        description="Gaming news, GTA 6 updates, casual game guides and puzzle tips from Game8Arena. Short reads for players who like quick, smart games."
        path="/blogs"
        jsonLd={[
          blogListSchema(posts),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blogs" },
          ]),
        ]}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li aria-current="page">Blog</li>
        </ol>
      </nav>
      <h1>Gaming News and Puzzle Game Guides</h1>
      <p className="blog-intro">
        The Game8Arena blog: the latest gaming news, including GTA 6 updates, plus casual game guides and tips that help you solve puzzles faster. Every guide
        links to free games you can play in your browser right away.
      </p>
      <div className="blog-list">
        {posts.map((p) => (
          <Link to={blogPath(p.slug)}>
            <article key={p.slug} className="blog-card">
              <p className="blog-meta">
                <span className="blog-cat">{p.category}</span> · <time dateTime={p.date}>{formatDate(p.date)}</time>
              </p>
              <h2>{p.title}</h2>
              <p>{p.excerpt}</p>
              <p to={blogPath(p.slug)} className="blog-more" aria-label={`Read: ${p.title}`}>
                Read more →
              </p>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
