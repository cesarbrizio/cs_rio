import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
}

interface ContextMenuProps {
  children: ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenu({ children, items }: ContextMenuProps): JSX.Element {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!position) {
      return;
    }

    const handleClose = () => setPosition(null);

    window.addEventListener('click', handleClose);
    window.addEventListener('blur', handleClose);

    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('blur', handleClose);
    };
  }, [position]);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <div className="ui-context-menu" onContextMenu={handleContextMenu}>
      {children}
      {position ? (
        <div className="ui-context-menu__popup" style={{ left: position.x, top: position.y }}>
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onSelect();
                setPosition(null);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
