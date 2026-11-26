/* oxlint-disable react/only-export-components -- formatDate is shared with the blog index */
import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import { blogPath, blogPostBySlug } from '../data/blogPosts'
import BlogCover from '../components/BlogCover'
import PlayCta from '../components/PlayCta'
import { headingIds, postCover, postGame, readingMinutes, relatedPosts } from '../data/blogMeta'
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

function Figure({ block, hero = false }) {
  return (
    <figure className={hero ? "blog-image blog-hero" : "blog-image"}>
      <img src={block.url} alt={block.alt} loading={hero ? "eager" : "lazy"} decoding="async" data-filename={block.filename} />
      <figcaption>
        {block.caption}{' '}
        {block.sourceUrl && <a href={block.sourceUrl} target="_blank" rel="noopener noreferrer">Photo source</a>}
      </figcaption>
    </figure>
  )
}

function Block({ block, id, lede }) {
  if (block?.type === 'image') return <Figure block={block} />
  if (Array.isArray(block))
    return (
      <ul>
        {block.map((item, i) => <li key={i}><Inline text={item} /></li>)}
      </ul>
    )
  if (block.startsWith('### ')) return <h3 id={id}>{block.slice(4)}</h3>
  if (block.startsWith('## ')) return <h2 id={id}>{block.slice(3)}</h2>
  return <p className={lede ? 'blog-lede' : undefined}><Inline text={block} /></p>
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = blogPostBySlug[slug]
  if (!post) return <NotFound />

  const related = relatedPosts(post)
  const game = postGame(post)
  const cover = postCover(post)
  const ids = headingIds(post)
  const toc = post.body.flatMap((b, i) => (typeof b === 'string' && b.startsWith('## ') ? [{ id: ids[i], text: b.slice(3) }] : []))
  const ledeAt = post.body.findIndex(b => typeof b === 'string' && !b.startsWith('#'))
  // Mid-article call to action: just before the third section, so readers have the rules before being asked to play.
  const h2s = post.body.reduce((acc, b, i) => (typeof b === 'string' && b.startsWith('## ') ? [...acc, i] : acc), [])
  const ctaAt = h2s[2] ?? -1

  return (
    <div className="post-shell">
      <article className="blog-post">
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
          <span className="blog-cat">{post.category}</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          {post.updated !== post.date && <span>Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time></span>}
          <span>{readingMinutes(post)} min read</span>
          <span>By the Game8Arena team</span>
        </p>

        {game && post.ctaPlacement === 'top' && <PlayCta game={game} />}

        {cover ? <Figure block={cover} hero /> : <BlogCover post={post} eager />}

        {toc.length >= 3 && (
          <nav className="toc toc-inline" aria-label="On this page">
            <p className="toc-title">On this page</p>
            <ol>
              {toc.map(t => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}
            </ol>
          </nav>
        )}

        {post.body.map((b, i) => {
          // The cover photo already sits above the article; don't show the same photo twice.
          if (cover && b?.type === 'image' && b.url === cover.url) return null
          return (
            <Fragment key={i}>
              {game && post.ctaPlacement !== 'top' && i === ctaAt && <PlayCta game={game} inline />}
              <Block block={b} id={ids[i]} lede={i === ledeAt} />
            </Fragment>
          )
        })}

        {game ? post.ctaPlacement === 'top' ? null : (
          <PlayCta game={game} />
        ) : (
          <aside className="play-cta" aria-label="Play free games">
            <div className="play-cta-body">
              <p className="play-cta-title">Play free puzzle games</p>
              <p className="play-cta-text">Logic puzzles, brain teasers and memory games. No download, no sign-up.</p>
              <div className="play-cta-actions">
                <Link to="/" className="btn-play">Play free games</Link>
              </div>
            </div>
          </aside>
        )}

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

        <section className="related-guides" aria-labelledby="related-h">
          <h2 id="related-h">Related guides</h2>
          <div className="related-grid">
            {related.map(p => (
              <Link key={p.slug} to={blogPath(p.slug)} className="blog-link" aria-label={p.title}>
                <article className="blog-card">
                  <BlogCover post={p} />
                  <div className="blog-card-body">
                    <p className="blog-meta">
                      <span className="blog-cat">{postGame(p)?.title || p.category}</span>
                      <span>{readingMinutes(p)} min read</span>
                    </p>
                    <h3>{p.title}</h3>
                  </div>
                </article>
              </Link>
            ))}
          </div>
          <Link to="/blogs" className="back">← All posts</Link>
        </section>
      </article>

      {toc.length >= 3 && (
        <aside className="toc toc-side">
          <nav aria-label="On this page">
            <p className="toc-title">On this page</p>
            <ol>
              {toc.map(t => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}
            </ol>
          </nav>
        </aside>
      )}
    </div>
  )
}
