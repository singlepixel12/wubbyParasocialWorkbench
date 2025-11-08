/**
 * PageHeader Component
 * Reusable page header with title and description
 * Used across all main pages for consistency
 */

interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2">{description}</p>
    </div>
  );
}
