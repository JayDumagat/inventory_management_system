import { Button } from "./Button";

interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

export function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  itemLabel = "items",
  className = "",
}: PaginationProps) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-xs text-muted">
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Previous
        </Button>
        <span className="text-xs text-muted min-w-[72px] text-center">
          Page {safePage} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
