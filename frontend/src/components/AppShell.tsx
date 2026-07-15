import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bug, Layers3, ShieldCheck, Sparkles } from 'lucide-react';
import { nav } from '../app/nav';
import type { StatusOverview } from '../app/types';
import { SidebarUserBox } from '../features/auth/SidebarUserBox';
import type { AuthUser } from '../features/auth/types';
import { getDebugPing } from '../features/debug/debugApi';
import { useUpdateStatusRefresh } from '../features/update/useUpdateStatusRefresh';
import { cx } from '../lib/cx';
import { Card } from './Card';
import { Clock } from './Clock';
import { StatusBadge } from './StatusBadge';

export function AppShell({
  user,
  onSignOut,
  children,
}: {
  user: AuthUser;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeItem = useMemo(
    () => nav.find((item) => pathname === `/${item.id}`) ?? nav[0],
    [pathname],
  );

  const [overview, setOverview] = useState<StatusOverview | null>(null);

  useEffect(() => {
    fetch('/api/status/overview')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StatusOverview>;
      })
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  const serviceIsOk = (name: string) =>
    Boolean(overview?.services.find((service) => service.name === name)?.ok);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  useUpdateStatusRefresh((status) => {
    setUpdateAvailable(
      Boolean(status?.services.some((service) => !service.upToDate)),
    );
    setCurrentVersion(status?.currentVersion ?? null);
    setAvailableVersion(status?.availableVersion ?? null);
  });

  const [debugPinging, setDebugPinging] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  function pingDebugEndpoint() {
    setDebugPinging(true);
    setDebugMessage(null);
    getDebugPing()
      .then((data) => setDebugMessage(data.message))
      .catch((error) => setDebugMessage(`Error: ${error.message}`))
      .finally(() => setDebugPinging(false));
  }

  return (
    <div className='app-root'>
      <div className='workbench'>
        <aside className='desktop-sidebar'>
          <div className='sidebar-brand'>
            <div className='brand-icon'>
              <Layers3 size={24} />
            </div>
            <div>
              <p>Minima Edge Stack</p>
              <h1>Edge Workbench</h1>
            </div>
          </div>

          <SidebarUserBox
            user={user}
            onSignOut={onSignOut}
            onSettings={() => navigate('/settings')}
          />

          <nav className='nav-list'>
            {nav.map(({ id, label, icon: Icon, badge }) => (
              <NavLink
                key={id}
                to={`/${id}`}
                className={({ isActive }) =>
                  cx('nav-item', isActive && 'active')
                }
              >
                <span>
                  <Icon size={19} />
                  {label}
                </span>
                {badge && <span className='nav-badge'>{badge}</span>}
              </NavLink>
            ))}
          </nav>

          {updateAvailable && (
            <a href='/update' className='update-available-card-link'>
              <Card className='update-available-card'>
                <div>
                  <Sparkles size={18} /> Update available
                </div>
                {currentVersion && availableVersion && (
                  <p className='update-version-line'>
                    {currentVersion} &rarr; {availableVersion}
                  </p>
                )}
                <p>
                  A new version is ready to be installed. Click to view details
                  and update.
                </p>
              </Card>
            </a>
          )}

          <Card className='sidebar-note'>
            <div>
              <ShieldCheck size={18} /> Edge gateway prototype
            </div>
            <p>
              A browser-first workbench for node, wallet, verified data, and
              automation workflows at the edge.
            </p>
            {currentVersion && <p className='sidebar-note-version'>{currentVersion}</p>}
          </Card>

          <Card className='sidebar-note debug-ping-card'>
            <div>
              <Bug size={18} /> Debug ping v2
            </div>
            <p>
              Checks that the frontend and backend you're looking at were both
              built from the progress bar + status cache fix.
            </p>
            <button
              type='button'
              onClick={pingDebugEndpoint}
              disabled={debugPinging}
            >
              {debugPinging ? 'Pinging…' : 'Ping backend'}
            </button>
            {debugMessage && <p className='debug-ping-message'>{debugMessage}</p>}
          </Card>
        </aside>

        <main className='main-area'>
          <header className='topbar'>
            <div className='topbar-left'>
              <div className='topbar-title'>
                <div>
                  <p>Current section</p>
                  <h2>{activeItem.label}</h2>
                </div>
              </div>
              <div className='topbar-pills'>
                <StatusBadge ok={serviceIsOk('backend')}>
                  Node online
                </StatusBadge>
                <StatusBadge ok={serviceIsOk('minima')}>
                  Wallet ready
                </StatusBadge>
                <StatusBadge ok={serviceIsOk('integritas')}>
                  Integritas connected
                </StatusBadge>
              </div>
            </div>
            <div className='topbar-right'>
              <Clock />
            </div>
          </header>

          <div className='mobile-nav'>
            {nav.map(({ id, label }) => (
              <NavLink
                key={id}
                to={`/${id}`}
                className={({ isActive }) => cx(isActive && 'active')}
              >
                {label}
              </NavLink>
            ))}
            {updateAvailable && <a href='/update'>Update</a>}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
