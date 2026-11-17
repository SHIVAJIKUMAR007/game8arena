import { Link } from 'react-router-dom'
import { blogPath, blogPosts } from '../data/blogPosts'
import Seo from '../seo/Seo'
import { blogListSchema, breadcrumbSchema } from '../seo/schema'
import { formatDate } from './BlogPost'

export default function Blogs() {
  const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="blog">
      <Seo
        title="Game8Arena Blog: Gaming News, Guides and Puzzle Tips"
        fullTitle
        description="Gaming news, GTA 6 updates, casual game guides and puzzle tips from Game8Arena. Short reads for players who like quick, smart games."
        path="/blogs"
        jsonLd={[blogListSchema(posts), breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blogs' }])]}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Home</Link></li>
          <li aria-current="page">Blog</li>
        </ol>
      </nav>
      <h1>Game8Arena Blog</h1>
      <p className="blog-intro">Gaming news, casual game guides and tips to help you solve puzzles faster.</p>
      <div className="blog-list">
        {posts.map(p => (
          <article key={p.slug} className="blog-card">
            <p className="blog-meta">
              <span className="blog-cat">{p.category}</span> · <time dateTime={p.date}>{formatDate(p.date)}</time>
            </p>
            <h2>
              <Link to={blogPath(p.slug)}>{p.title}</Link>
            </h2>
            <p>{p.excerpt}</p>
            <Link to={blogPath(p.slug)} className="blog-more" aria-label={`Read: ${p.title}`}>
              Read more →
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
