import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'

interface RSSItem {
  title: string
  pubDate: string
  link: string
}

export default function Home() {
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
    fetch('/api/rss')
      .then(res => res.json())
      .then(data => {
        setRssItems(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching RSS:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    // Center the terminal on mount
    if (isMounted && terminalRef.current) {
      // Use setTimeout to ensure the terminal is fully rendered
      setTimeout(() => {
        if (terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect()
          const centerX = (window.innerWidth - rect.width) / 2
          const centerY = (window.innerHeight - rect.height) / 2
          setPosition({
            x: Math.max(20, centerX),
            y: Math.max(20, centerY)
          })
          // Show terminal after positioning is set
          setTimeout(() => {
            setIsVisible(true)
          }, 50)
        }
      }, 0)
    }
  }, [isMounted])

  useEffect(() => {
    // Keep terminal within bounds on window resize
    const handleResize = () => {
      if (!terminalRef.current) return

      const rect = terminalRef.current.getBoundingClientRect()
      const terminalWidth = rect.width
      const terminalHeight = rect.height
      const padding = 20

      const maxX = window.innerWidth - terminalWidth - padding
      const maxY = window.innerHeight - terminalHeight - padding

      setPosition(prev => ({
        x: Math.max(padding, Math.min(prev.x, maxX)),
        y: Math.max(padding, Math.min(prev.y, maxY))
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Disable dragging on mobile
    if (window.innerWidth <= 768) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Disable dragging on mobile
      if (window.innerWidth <= 768) {
        setIsDragging(false)
        return
      }

      if (!isDragging || !terminalRef.current) return

      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // Get actual terminal dimensions
      const rect = terminalRef.current.getBoundingClientRect()
      const terminalWidth = rect.width
      const terminalHeight = rect.height

      // Constrain to viewport with padding
      const padding = 20
      const maxX = window.innerWidth - terminalWidth - padding
      const maxY = window.innerHeight - terminalHeight - padding

      setPosition({
        x: Math.max(padding, Math.min(newX, maxX)),
        y: Math.max(padding, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const asciiArt = `
██╗  ██╗██╗   ██╗██████╗ ██╗██╗     ██╗        ██╗   ██╗███████╗
██║ ██╔╝╚██╗ ██╔╝██╔══██╗██║██║     ██║        ██║   ██║██╔════╝
█████╔╝  ╚████╔╝ ██████╔╝██║██║     ██║        ██║   ██║███████╗
██╔═██╗   ╚██╔╝  ██╔══██╗██║██║     ██║        ██║   ██║╚════██║
██║  ██╗   ██║   ██║  ██║██║███████╗███████╗██╗╚██████╔╝███████║
╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═╝ ╚═════╝ ╚══════╝
`

  return (
    <>
      <Head>
        <title>Kyrillus</title>
        <meta name="description" content="Computer Science @ TU Wien" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ position: 'relative', width: '100vw', minHeight: '100vh', overflow: 'hidden', paddingBottom: '20px' }}>
        <div
          ref={terminalRef}
          className={`terminal-window ${isVisible ? 'terminal-visible' : 'terminal-hidden'}`}
          style={{
            position: isMounted ? 'absolute' : 'relative',
            left: isMounted ? `${position.x}px` : 'auto',
            top: isMounted ? `${position.y}px` : 'auto',
            margin: isMounted ? '0' : '20px auto',
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          <div
            className="terminal-titlebar"
            onMouseDown={handleMouseDown}
            style={{ cursor: isMounted && typeof window !== 'undefined' && window.innerWidth > 768 ? 'grab' : 'default' }}
          >
            <div className="terminal-button terminal-button-red"></div>
            <div className="terminal-button terminal-button-yellow"></div>
            <div className="terminal-button terminal-button-green"></div>
          </div>
          <div className="terminal-content">
            <div className="ascii-art">{asciiArt}</div>

            <header className="mb-8">
              <p className="text-sm md:text-base text-[#b4b4b4] leading-relaxed mb-2">
                Computer Science @ TU Wien. Building in physical AI.
              </p>
            </header>

            <section className="mb-8">
              <p className="text-sm md:text-base text-[#b4b4b4] leading-relaxed">
                Currently: VLA models for contact-rich manipulation at the AI Lab, TU Wien Robotics Club.
              </p>

            </section>

            {/*<section className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs uppercase tracking-wider text-[#888888] font-medium">
                  articles
                </h2>
                {!loading && rssItems.length > 0 && (
                  <a
                    href="https://blog.kyrill.us"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#666666] hover:text-[#999999] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999]"
                  >
                    [view all]
                  </a>
                )}
              </div>
              {loading ? (
                <p className="text-sm text-[#888888]">Loading...</p>
              ) : rssItems.length > 0 ? (
                <ul className="space-y-3">
                  {rssItems.slice(0, 5).map((item, index) => (
                    <li key={index} className="text-sm md:text-base group">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#c8c8c8] hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                      >
                        {item.title}
                      </a>
                      <span className="text-[#666666] ml-3 text-xs font-light">
                        {formatDate(item.pubDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#888888]">No articles yet.</p>
              )}
            </section>*/}

            <section className="mt-8 pt-6 border-t border-[#2d2f37]">
              <h2 className="text-xs uppercase tracking-wider text-[#888888] mb-4 font-medium">
                Contact
              </h2>
              <nav className="flex flex-wrap gap-6 text-sm text-[#c8c8c8]">
                <a
                  href="https://linkedin.com/in/kyrillus"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                >
                  LinkedIn
                </a>
                <a
                  href="https://x.com/kyrill_us"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                >
                  X
                </a>
                <a
                  href="https://github.com/kyrillus"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                >
                  GitHub
                </a>
                <a
                  href="https://www.instagram.com/kyrill.us/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                >
                  Instagram
                </a>
                <a
                  href="mailto:contact@kyrill.us"
                  className="hover:text-[#e8e8e8] transition-all duration-200 underline decoration-[#666666] hover:decoration-[#999999] hover:decoration-2"
                >
                  contact@kyrill.us
                </a>
              </nav>
            </section>

            <div className="mt-8 text-[#666666] text-sm">
              <span className="cursor"></span>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
