export interface TabItem {
  description?: string;
  id: string;
  label: string;
}

interface TabsProps {
  activeId: string;
  items: TabItem[];
  onChange: (id: string) => void;
}

export function Tabs({ activeId, items, onChange }: TabsProps): JSX.Element {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={item.id === activeId}
          className={`ui-tabs__trigger ${item.id === activeId ? 'ui-tabs__trigger--active' : ''}`}
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          title={item.description}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
