'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { EmptyCart, CartItems } from '@/features/cart/components';
import { hydrateCart, selectCartItems } from '@/lib/redux/slices/cartSlice/cartSlice';
import CmsBannerSlider from '@/components/cms/CmsBannerSlider';

export default function CartPage() {
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);

  // Hydrate from localStorage on mount in case the store was created before storage was readable.
  useEffect(() => {
    dispatch(hydrateCart());
  }, [dispatch]);

  // Bug_80 fix: set a specific document.title for the cart page so the tab
  // label is "Cart | QuickHire" instead of the inherited generic site title.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.title;
    document.title = 'Cart | QuickHire';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* CMS slot: cart-top — promo / discount banners for users mid-checkout. */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <CmsBannerSlider position="cart-top" />
      </div>
      {/* Bug_80 fix: breadcrumb at top of cart page (Home > Cart). */}
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-20 pt-4"
      >
        <ol className="flex items-center gap-2 text-sm text-gray-500">
          <li>
            <Link href="/" className="hover:text-[#45A735] hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-300">
            /
          </li>
          <li aria-current="page" className="text-gray-900 font-medium">
            Cart
          </li>
        </ol>
      </nav>
      {items.length > 0 ? <CartItems /> : <EmptyCart />}
    </div>
  );
}
