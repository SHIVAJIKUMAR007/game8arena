import { Link } from "react-router-dom";
import BlogCover from "../components/BlogCover";
import { blogPath, blogPosts } from "../data/blogPosts";
import { postGame, readingMinutes } from "../data/blogMeta";
import Seo from "../seo/Seo";
import { blogListSchema, breadcrumbSchema } from "../seo/schema";
import { formatDate } from "./BlogPost";

function PostMeta({ post }) {
  const game = postGame(post);
  return (
    <p className="blog-meta">
      <span className="blog-cat">{game ? game.title : post.category}</span>
      <time dateTime={post.date}>{formatDate(post.date)}</time>
      <span>{readingMinutes(post)} min read</span>
    </p>
  );
}

export default function Blogs() {
  const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));
  // Feature the newest guide about one of our games; fall back to the newest post.
  const featured = posts.find((p) => postGame(p)) || posts[0];
  const rest = posts.filter((p) => p !== featured);
  return (
    <div className="blog">
      <Seo
        title="Game8Arena Blog: Browser Game Guides and Tips"
        fullTitle
        description="Practical guides to Game8Arena games, including rules, controls and strategies. Written by Game8Arena creator Shivaji Kumar."
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
      <h1>Browser Game Guides and Tips</h1>
      <p className="blog-intro">
        Read practical guides to the rules, controls and strategies in Game8Arena games. Each guide links to the game it covers so you can try it in your browser.
      </p>

      <Link to={blogPath(featured.slug)} className="blog-featured" aria-label={featured.title}>
        <article>
          <BlogCover post={featured} eager />
          <div className="blog-featured-body">
            <PostMeta post={featured} />
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <p className="blog-more">Read more →</p>
          </div>
        </article>
      </Link>

      <div className="blog-list">
        {rest.map((p) => (
          <Link key={p.slug} to={blogPath(p.slug)} aria-label={p.title} className="blog-link">
            <article className="blog-card">
              <BlogCover post={p} />
              <div className="blog-card-body">
                <PostMeta post={p} />
                <h2>{p.title}</h2>
                <p>{p.excerpt}</p>
                <p className="blog-more">Read more →</p>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}
