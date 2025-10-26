import { useState, useEffect } from 'react';
import { searchApi } from '@/lib/api';
import type { Content } from '@cms/shared';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Content[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await searchApi.search({ q: query, limit: 5 });
        setResults(response.items);
        setIsOpen(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search articles..."
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {results.map((article) => (
                <li key={article.id}>
                  <a
                    href={`/blog/${article.slug}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {article.title}
                    </h4>
                    {article.excerpt && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {article.excerpt}
                      </p>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No results found
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}