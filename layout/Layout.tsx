import Link from 'next/link';
import { useRouter } from 'next/router';

const navItems = [
  { title: 'VaultChain Status', href: '/vault/vaultchain-status' },
  { title: 'Home', href: '/' },
  { title: 'Discover', href: '/discover' },
  { title: 'Viewer', href: '/viewer/truthdeck-ui' },
  { title: 'Certificates', href: '/certificate' },
  { title: 'Diff', href: '/diff' },
  { title: 'Badges', href: '/VaultBridge/badges' },
  { title: 'About', href: '/about' },
  { title: 'Contact', href: '/contact' },
  { title: 'Privacy', href: '/privacy' },
  { title: 'Terms', href: '/terms' },
  { title: 'Register', href: '/witness/register' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="layout-wrapper">
      <aside className="layout-sidebar">
        <nav>
          <ul className="layout-nav-list">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? router.pathname === '/'
                  : router.pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`layout-nav-link${isActive ? ' layout-nav-link-active' : ''}`}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="layout-content">{children}</div>
    </div>
  );
}
