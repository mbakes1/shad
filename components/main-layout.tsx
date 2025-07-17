"use client"

import { ReactNode } from "react"
import NavigationHeader from "./navigation-header"
import { usePathname } from "next/navigation"

interface MainLayoutProps {
  children: ReactNode
  className?: string
}

export default function MainLayout({ children, className = "" }: MainLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader currentPath={pathname} />
      
      <main className={`flex-1 ${className}`} role="main">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
      
      <footer className="border-t bg-muted/50" role="contentinfo">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                South African Government Tender Portal
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <p className="text-xs text-muted-foreground">
                Data sourced from OCDS API
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}