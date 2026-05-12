'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  removeFromCart,
  updateQuantity,
  clearCart,
  selectCart,
} from '@/lib/redux/slices/cartSlice/cartSlice';
import { usePrice } from '@/lib/hooks/usePrice';
import { paymentService } from '@/lib/services/paymentApi';
import { selectTaxInfo } from '@/lib/redux/slices/regionSlice/regionSlice';

/* ─── SDK loader ────────────────────────────────────────────────── */

function loadRazorpay() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/* ─── CartItems ─────────────────────────────────────────────────── */

const CartItems = () => {
  const dispatch = useDispatch();
  const router   = useRouter();
  const t = useTranslations('cart');
  const { items: cartItems, subtotal, tax, total } = useSelector(selectCart);
  const { taxRate, taxLabel } = useSelector(selectTaxInfo);
  const { format: fmtMoney } = usePrice();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const paymentInFlight = useRef(false);

  const handleRemoveItem = (id) => dispatch(removeFromCart(id));
  const handleQty = (id, quantity) => dispatch(updateQuantity({ id, quantity }));

  // Extract jobId from cart items (set when user goes back from the booking stepper)
  const jobIdFromCart = useMemo(() => {
    for (const i of cartItems) {
      if (i?.meta?.jobId) return i.meta.jobId;
    }
    return null;
  }, [cartItems]);

  const isLoggedIn = typeof window !== 'undefined' && !!window.localStorage.getItem('token');

  /* ─── Payment handler ─────────────────────────────────────────── */

  const handleCheckout = async () => {
    if (paymentInFlight.current) return;
    setError(null);

    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent('/cart')}`);
      return;
    }

    // Guard: ₹0 cart means service pricing isn't configured in the admin panel.
    if (!total || total <= 0) {
      setError('This service has no price configured yet. Please contact support or try booking directly from the service page.');
      return;
    }

    if (!jobIdFromCart) {
      setError('No booking linked to this cart. Please add the service again from the service page.');
      return;
    }

    paymentInFlight.current = true;
    setIsProcessing(true);

    try {
      const orderResponse = await paymentService.createOrder(jobIdFromCart, total);
      const paymentData = orderResponse.data?.data || orderResponse.data;
      const gateway = paymentData.gateway || 'razorpay';

      if (gateway === 'mock' || paymentData.mock) {
        dispatch(clearCart());
        if (typeof window !== 'undefined') {
          try { window.localStorage.removeItem('qh_cart_v1'); } catch { /* ignore */ }
        }
        router.push(`/payment-success?jobId=${jobIdFromCart}`);
        return;
      }

      if (gateway === 'razorpay') {
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Failed to load Razorpay. Please refresh and try again.');

        await new Promise((resolve, reject) => {
          const options = {
            key: paymentData.keyId || paymentData.key,
            amount: paymentData.amount,
            currency: paymentData.currency || 'INR',
            name: 'QuickHire',
            description: 'Service Booking Payment',
            order_id: paymentData.orderId || paymentData.razorpayOrderId,
            handler: async (response) => {
              try {
                await paymentService.verifyPayment({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_signature:  response.razorpay_signature,
                });
              } catch { /* webhook confirms even if verify fails */ }
              dispatch(clearCart());
              if (typeof window !== 'undefined') {
                try { window.localStorage.removeItem('qh_cart_v1'); } catch { /* ignore */ }
              }
              router.push(`/payment-success?jobId=${jobIdFromCart}`);
              resolve();
            },
            modal: { ondismiss: () => reject(new Error('dismissed')) },
            theme: { color: '#45A735' },
          };
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (resp) => {
            reject(new Error(resp?.error?.description || 'Payment failed'));
          });
          rzp.open();
        });
        return;
      }

      // Stripe or other gateways — redirect to full checkout page
      router.push('/checkout');
    } catch (e) {
      if (e?.message !== 'dismissed') {
        setError(e?.response?.data?.message || e?.message || 'Checkout failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      paymentInFlight.current = false;
    }
  };

  const displayTaxRate = Math.round((taxRate || 0.18) * 100);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('shoppingCart')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => {
              const itemId = item.id || item.serviceId;
              return (
                <div key={itemId} className="bg-white rounded-lg shadow-sm p-6 flex gap-6">
                  {/* Item Image */}
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                    {item.image && (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name}</h3>
                    {item.duration && (
                      <p className="text-sm text-gray-600 mb-2">{item.duration}</p>
                    )}
                    {item.meta?.technicalSkills && (
                      <p className="text-xs text-gray-400 mb-2">{item.meta.technicalSkills}</p>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => handleQty(itemId, (item.quantity || 1) - 1)}
                        className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                        aria-label={t('decreaseQty')}
                      >
                        −
                      </button>
                      <span className="min-w-[2ch] text-center font-medium">{item.quantity || 1}</span>
                      <button
                        type="button"
                        onClick={() => handleQty(itemId, (item.quantity || 1) + 1)}
                        className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                        aria-label={t('increaseQty')}
                      >
                        +
                      </button>
                    </div>
                    <p className="text-xl font-bold text-[#45A735]">
                      {fmtMoney(Number(item.price * (item.quantity || 1)))}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveItem(itemId)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    aria-label={t('removeItem')}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('orderSummary')}</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>{t('subtotal')}</span>
                  <span>{fmtMoney(Number(subtotal))}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{taxLabel || `Tax (${displayTaxRate}%)`}</span>
                  <span>{fmtMoney(Number(tax))}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-lg">
                  <span>{t('total')}</span>
                  <span className="text-[#45A735]">{fmtMoney(Number(total))}</span>
                </div>
              </div>

              {/* Inline error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>
              )}

              {/* ₹0 warning */}
              {total <= 0 && !error && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  Service pricing not configured. Please contact support.
                </p>
              )}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={isProcessing || total <= 0}
                className="block w-full px-6 py-3 bg-[#45A735] text-white text-center rounded-lg font-semibold hover:bg-[#3d9230] transition-colors mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing…' : t('proceedCheckout')}
              </button>

              <a
                href="/book-your-resource"
                className="block w-full px-6 py-3 border-2 border-gray-300 text-gray-700 text-center rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                {t('continueShopping')}
              </a>

              <p className="text-xs text-center text-gray-400 mt-3">
                Secured by PCI-DSS compliant payment processing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItems;
