'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const EmptyCart = () => {
  const t = useTranslations('cart');
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('shoppingCart')}</h1>

        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <svg
            className="w-24 h-24 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <p className="text-xl font-medium text-gray-900 mb-2">{t('empty')}</p>
          <p className="text-gray-500 mb-6">
            {t('emptyDescServices')}
          </p>
          {/* Bug_55 fix: ensure empty cart always shows a clear, primary
              CTA pointing to the service-browse landing. Using the bare
              `/book-your-resource` path so the user lands at the top of the
              browse experience, not deep-linked into the experts section. */}
          <Link
            href="/book-your-resource"
            data-testid="empty-cart-browse-services"
            className="inline-block px-6 py-3 bg-[#45A735] text-white rounded-lg font-semibold hover:bg-[#3d9230] transition-colors"
          >
            {t('browseServices')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmptyCart;
