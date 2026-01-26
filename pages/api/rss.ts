import type { NextApiRequest, NextApiResponse } from 'next'

interface RSSItem {
  title: string
  pubDate: string
  link: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const feedUrl = 'https://kyrillus.substack.com/feed'
    const response = await fetch(feedUrl)
    
    if (!response.ok) {
      throw new Error('Failed to fetch RSS feed')
    }
    
    const xml = await response.text()

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    // Parse RSS items using regex
    const items: RSSItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const itemsMatch = Array.from(xml.matchAll(itemRegex))
    
    for (const itemMatch of itemsMatch) {
      const itemContent = itemMatch[1]
      
      // Extract title (handle both CDATA and plain text)
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)
      // Extract pubDate
      const dateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)
      // Extract link
      const linkMatch = itemContent.match(/<link>(.*?)<\/link>/)
      
      if (titleMatch && dateMatch && linkMatch) {
        items.push({
          title: titleMatch[1].trim(),
          pubDate: dateMatch[1].trim(),
          link: linkMatch[1].trim()
        })
      }
      
      // Limit to 5 items
      if (items.length >= 5) break
    }
    
    res.status(200).json(items)
  } catch (error) {
    console.error('Error fetching RSS feed:', error)
    res.status(500).json({ error: 'Failed to fetch RSS feed' })
  }
}

