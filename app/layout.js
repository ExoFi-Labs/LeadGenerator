import './globals.css'

export const metadata = {
  title: 'Lead Generator - Find Businesses Without Websites',
  description: 'Find local businesses that need a website',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
