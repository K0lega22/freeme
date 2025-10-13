import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/DashboardClient'
import LogoutButton from '@/components/LogoutButton'
import Sidebar from '@/components/Sidebar'
import { Menu } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition">
              <Menu className="text-gray-400" size={24} />
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              Freeme
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden md:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-6 overflow-y-auto">
          <DashboardClient initialEvents={events || []} />
        </main>

        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <aside className="hidden xl:block">
          <Sidebar />
        </aside>
      </div>
    </div>
  )
}