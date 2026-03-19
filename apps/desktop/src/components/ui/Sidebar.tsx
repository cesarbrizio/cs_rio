import { NavLink } from 'react-router-dom';

import type { DesktopNavigationItem } from '../../config/navigation';
import { formatDesktopShortcut } from '../../runtime/desktopShell';
import { useDesktopRuntimeStore } from '../../stores/desktopRuntimeStore';

interface SidebarProps {
  footer?: JSX.Element | null;
  header?: JSX.Element | null;
  items: DesktopNavigationItem[];
  pathname: string;
}

export function Sidebar({
  footer = null,
  header = null,
  items,
  pathname,
}: SidebarProps): JSX.Element {
  const keybindings = useDesktopRuntimeStore((state) => state.shellSettings.keybindings);

  return (
    <aside className="ui-sidebar">
      <div className="ui-sidebar__top">
        <div className="ui-sidebar__brand">
          <span className="eyebrow">CS Rio</span>
          <strong>Desktop</strong>
        </div>
        {header}
      </div>

      <nav className="ui-sidebar__nav">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.path);
          const quickIndex = items.indexOf(item);
          const shortcutBinding =
            quickIndex >= 0 && quickIndex < 9
              ? keybindings[`quick_nav_${quickIndex + 1}` as keyof typeof keybindings]
              : null;

          return (
            <NavLink
              className={`ui-sidebar__link ${isActive ? 'ui-sidebar__link--active' : ''}`}
              key={item.path}
              to={item.path}
            >
              <div className="ui-sidebar__link-top">
                <strong>{item.label}</strong>
                {shortcutBinding ? (
                  <span className="ui-sidebar__shortcut">
                    {formatDesktopShortcut(shortcutBinding)}
                  </span>
                ) : null}
              </div>
              <span>{item.description}</span>
            </NavLink>
          );
        })}
      </nav>

      {footer ? <div className="ui-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}
