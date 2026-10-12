import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  Cloud,
  CloudOff,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/store/auth';
import { useOnlineSync } from '@/lib/offline/sync';
import { cn, initials } from '@/lib/utils';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/catalog', label: 'Course catalog', icon: Library, roles: ['student'] },
  { to: '/app/courses', label: 'My learning', icon: BookOpen, roles: ['student'] },
  { to: '/app/assignments', label: 'Assignments', icon: FileText },
  { to: '/app/projects', label: 'Final project', icon: FolderKanban, roles: ['student'] },
  { to: '/app/certificates', label: 'Certificates', icon: GraduationCap },
  { to: '/app/teaching', label: 'Teaching', icon: BookOpen, roles: ['teacher'] },
  { to: '/app/admin/books', label: 'Source books', icon: Library, roles: ['platform_admin', 'platform_owner'] },
  { to: '/app/admin/courses', label: 'Courses', icon: BookOpen, roles: ['platform_admin', 'platform_owner'] },
  { to: '/app/admin/users', label: 'Users', icon: Users, roles: ['platform_admin', 'platform_owner'] },
  { to: '/app/admin/schools', label: 'Schools', icon: Shield, roles: ['platform_admin', 'platform_owner'] },
  { to: '/app/admin/reports', label: 'Reports', icon: FileText, roles: ['platform_admin', 'platform_owner', 'school_admin'] },
  { to: '/app/admin/cms', label: 'Content (CMS)', icon: Settings, roles: ['platform_admin', 'platform_owner'] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const online = useOnlineSync();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/app'}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
            )
          }
        >
          <item.icon className="h-[18px] w-[18px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">{sidebar}</div>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
              <p className="truncate text-xs capitalize text-slate-400">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <Logo />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto">{sidebar}</div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">
                Hello, {user.name.split(' ')[0]}
              </p>
              <p className="text-xs text-slate-400">Welcome back to IshConnect</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={online.online ? 'success' : 'warning'} className="hidden gap-1.5 sm:inline-flex">
              {online.online ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
              {online.online ? 'Online' : 'Offline'}
            </Badge>
            {online.pending > 0 && (
              <button
                type="button"
                onClick={() => void online.syncNow()}
                disabled={online.syncing}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
              >
                {online.syncing ? 'Syncing…' : `${online.pending} to sync`}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100">
                  <Avatar>
                    <AvatarFallback>{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/profile">Profile & settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/app/certificates">My certificates</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleLogout()} className="text-red-600 focus:bg-red-50">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main" className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
