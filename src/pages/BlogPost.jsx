/* oxlint-disable react/only-export-components -- formatDate is shared with the blog index */
import { Link, useParams } from 'react-router-dom'
import { blogPath, blogPostBySlug, blogPosts } from '../data/blogPosts'
import Seo from '../seo/Seo'
import { blogPostingSchema, breadcrumbSchema, faqSchema } from '../seo/schema'
import NotFound from './NotFound'

export const formatDate = iso =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

// Turns "[text](/path)" and "[text](https://…)" inside a paragraph into links.
function Inline({ text }) {
  const parts = []
  const re = /\[([^\]]+)\]\(([^)]+)\)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [, label, href] = m
    parts.push(
      href.startsWith('/') ? (
        <Link key={m.index} to={href}>{label}</Link>
      ) : (
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
      )
    )
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Block({ block }) {
  if (Array.isArray(block))
    return (
      <ul>
        {block.map((item, i) => <li key={i}><Inline text={item} /></li>)}
      </ul>
    )
  if (block.startsWith('## ')) return <h2>{block.slice(3)}</h2>
  return <p><Inline text={block} /></p>
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = blogPostBySlug[slug]
  if (!post) return <NotFound />

  const more = blogPosts.filter(p => p.slug !== slug).slice(0, 3)
  return (
    <article className="blog-post prose">
      <Seo
        title={post.metaTitle}
        description={post.metaDescription}
        path={blogPath(post.slug)}
        type="article"
        article={{ published: post.date, modified: post.updated, section: post.category, tags: post.tags }}
        jsonLd={[
          blogPostingSchema(post),
          ...(post.faq?.length ? [faqSchema(post.faq)] : []),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blogs' },
            { name: post.title, path: blogPath(post.slug) },
          ]),
        ]}
      />
      <nav className="crumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/blogs">Blog</Link></li>
          <li aria-current="page">{post.category}</li>
        </ol>
      </nav>
      <h1>{post.title}</h1>
      <p className="blog-meta">
        <span className="blog-cat">{post.category}</span> · <time dateTime={post.date}>{formatDate(post.date)}</time>
        {post.updated !== post.date && <> · Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time></>}
        {' '}· By the Game8Arena team
      </p>

      {post.body.map((b, i) => <Block key={i} block={b} />)}

      {post.faq?.length > 0 && (
        <section className="blog-faq">
          <h2>Frequently asked questions</h2>
          {post.faq.map(({ q, a }) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </section>
      )}

      {post.sources?.length > 0 && (
        <section className="blog-sources">
          <h2>Sources</h2>
          <ul>
            {post.sources.map(s => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></li>
            ))}
          </ul>
        </section>
      )}

      <section className="blog-more-posts">
        <h2>More from the blog</h2>
        <ul>
          {more.map(p => <li key={p.slug}><Link to={blogPath(p.slug)}>{p.title}</Link></li>)}
        </ul>
        <Link to="/blogs" className="back">← All posts</Link>
      </section>
    </article>
  )
}
