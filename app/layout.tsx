import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'Dragon Bike Danang',
  description: 'Premium Moto Rental in Da Nang',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        {/* Скрипт для работы Mini App */}
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive" 
        />
      </head>
      <body className="bg-[#05070a] antialiased">
        {children}
      </body>
    </html>
  )
}