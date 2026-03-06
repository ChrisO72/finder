import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { Link, useSearchParams } from "react-router";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];

  // Always show first page
  pages.push(1);

  if (currentPage <= 3) {
    // Near the start: 1, 2, 3, 4, ..., last
    pages.push(2, 3, 4, "ellipsis", totalPages);
  } else if (currentPage >= totalPages - 2) {
    // Near the end: 1, ..., last-3, last-2, last-1, last
    pages.push("ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    // In the middle: 1, ..., current-1, current, current+1, ..., last
    pages.push("ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages);
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  limit,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("pageSize", newSize.toString());
    params.set("page", "1"); // Reset to first page when changing page size
    setSearchParams(params);
  };

  if (totalPages <= 1 && pageSizeOptions.length <= 1) return null;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalCount);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const basePageClass =
    "relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0";
  const currentPageClass =
    "z-10 bg-gray-900 border-2 border-gray-900 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:bg-white dark:border-white dark:text-gray-900";
  const defaultPageClass =
    "text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 dark:text-gray-200 dark:inset-ring-gray-700 dark:hover:bg-white/5";
  const ellipsisClass =
    "text-gray-700 inset-ring inset-ring-gray-300 dark:text-gray-400 dark:inset-ring-gray-700";
  const arrowClass =
    "relative inline-flex items-center px-2 py-2 text-gray-400 inset-ring inset-ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:inset-ring-gray-700 dark:hover:bg-white/5";
  const disabledArrowClass =
    "relative inline-flex items-center px-2 py-2 text-gray-300 inset-ring inset-ring-gray-300 cursor-not-allowed dark:text-gray-600 dark:inset-ring-gray-700";

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-white/10 dark:bg-transparent">
      {/* Mobile view */}
      <div className="flex flex-1 justify-between sm:hidden">
        {currentPage > 1 ? (
          <Link
            to={buildPageUrl(currentPage - 1)}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Previous
          </Link>
        ) : (
          <span className="relative inline-flex cursor-not-allowed items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
            Previous
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            to={buildPageUrl(currentPage + 1)}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Next
          </Link>
        ) : (
          <span className="relative ml-3 inline-flex cursor-not-allowed items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500">
            Next
          </span>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">{startItem}</span> to{" "}
            <span className="font-medium">{endItem}</span> of{" "}
            <span className="font-medium">{totalCount}</span> results
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-gray-700 dark:text-gray-300">
              Items per page:
            </label>
            <select
              id="page-size"
              value={limit}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 inset-ring inset-ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:bg-transparent dark:text-gray-200 dark:inset-ring-gray-700 dark:hover:bg-white/5"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size} className="dark:bg-zinc-800">
                  {size}
                </option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="isolate inline-flex -space-x-px rounded-md shadow-xs dark:shadow-none"
            >
              {/* Previous arrow */}
              {currentPage > 1 ? (
                <Link to={buildPageUrl(currentPage - 1)} className={`${arrowClass} rounded-l-md`}>
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon aria-hidden="true" className="size-5" />
                </Link>
              ) : (
                <span className={`${disabledArrowClass} rounded-l-md`}>
                  <span className="sr-only">Previous</span>
                  <ChevronLeftIcon aria-hidden="true" className="size-5" />
                </span>
              )}

              {/* Page numbers */}
              {pageNumbers.map((pageNum, index) => {
                if (pageNum === "ellipsis") {
                  return (
                    <span key={`ellipsis-${index}`} className={`${basePageClass} ${ellipsisClass}`}>
                      ...
                    </span>
                  );
                }

                const isCurrentPage = pageNum === currentPage;
                return (
                  <Link
                    key={pageNum}
                    to={buildPageUrl(pageNum)}
                    aria-current={isCurrentPage ? "page" : undefined}
                    className={`${basePageClass} ${isCurrentPage ? currentPageClass : defaultPageClass}`}
                  >
                    {pageNum}
                  </Link>
                );
              })}

              {/* Next arrow */}
              {currentPage < totalPages ? (
                <Link to={buildPageUrl(currentPage + 1)} className={`${arrowClass} rounded-r-md`}>
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon aria-hidden="true" className="size-5" />
                </Link>
              ) : (
                <span className={`${disabledArrowClass} rounded-r-md`}>
                  <span className="sr-only">Next</span>
                  <ChevronRightIcon aria-hidden="true" className="size-5" />
                </span>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
