"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSelector } from "react-redux";
import { useI18nRouter } from "@/lib/hooks/useI18nRouter";
import Link from "@/components/common/I18nLink";
import { notificationsService } from "@/lib/services/notificationsApi";
import chatSocketService from "@/lib/services/chatSocketService";
import {
  resolveNotificationRoute,
  readCurrentRole,
} from "@/lib/utils/notificationRoute";
import { useTranslations } from "next-intl";

export const dynamic = "force-dynamic";

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function normalize(n) {
  if (!n) return null;
  return {
    id: n._id || n.id || n.messageId || `${Date.now()}-${Math.random()}`,
    title: n.title || "Notification",
    message: n.body || n.message || "",
    type: (n.type || "info").toString().toLowerCase().includes("cancel")
      ? "warning"
      : (n.type || "").toString().toLowerCase().includes("complete")
      ? "success"
      : (n.type || "").toString().toLowerCase().includes("error")
      ? "error"
      : "info",
    read: Boolean(n.read),
    time: formatTime(n.createdAt || n.time),
    raw: n,
  };
}

// Bug_40 fix: map notification type → status badge style so unread items have
// a clear visual hierarchy (icon + title + body + timestamp + badge).
function getStatusBadge(type, read) {
  if (!read) {
    return {
      label: "New",
      className: "bg-[#F2F9F1] text-[#26472B] border border-[#45A735]",
    };
  }
  switch (type) {
    case "success":
      return { label: "Completed", className: "bg-green-100 text-green-700" };
    case "warning":
      return { label: "Warning", className: "bg-yellow-100 text-yellow-700" };
    case "error":
      return { label: "Failed", className: "bg-red-100 text-red-700" };
    default:
      return { label: "Read", className: "bg-gray-100 text-gray-600" };
  }
}

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const router = useI18nRouter();
  // Bug_56 fix: track auth so we can show an explainer instead of a silent
  // redirect when an unauthenticated user lands on /notifications.
  const { isAuthenticated, isLoading: authLoading } = useSelector(
    (state) => state.auth || {},
  );
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await notificationsService.getAllNotifications(1, 30);
      const items = res?.data?.data || res?.data || [];
      setNotifications(items.map(normalize).filter(Boolean));
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Bug_56 fix: only fetch when the user is signed in. Avoids a 401 round
    // trip + immediate-redirect-with-no-message UX.
    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
    }
  }, [load, isAuthenticated]);

  // Live updates from the global socket connection.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const previous = chatSocketService.callbacks?.onNotificationReceived;
    const handler = (data) => {
      const n = normalize(data);
      if (n) setNotifications((prev) => [n, ...prev]);
      if (typeof previous === "function") {
        try {
          previous(data);
        } catch (e) {
          console.error("previous notification callback error", e);
        }
      }
    };
    if (chatSocketService.callbacks) {
      chatSocketService.callbacks.onNotificationReceived = handler;
    }
    return () => {
      if (chatSocketService.callbacks) {
        chatSocketService.callbacks.onNotificationReceived = previous;
      }
    };
  }, [isAuthenticated]);

  const handleMarkAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await notificationsService.deleteNotification(id);
    } catch (e) {
      console.error("Failed to mark notification read", e);
    }
  };

  // Click on a notification → mark read (if unread) AND deep-link to the
  // related entity. Without this the user has no way to reach the booking,
  // chat, or payment that the notification was actually about.
  const handleOpenNotification = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    const target = resolveNotificationRoute(notification.raw, readCurrentRole());
    if (target) {
      router.push(target);
    }
  };

  const handleClearAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsService.markAllRead();
    } catch (e) {
      console.error("Failed to mark all read", e);
    }
  };

  // Bug_56 fix: friendly unauthenticated state with an explicit CTA instead
  // of an opaque redirect.
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2F9F1] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#26472B]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#26472B] mb-2">
              Sign in to see your notifications
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              You will see booking updates, payment confirmations, and messages
              from your hired resource here.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#45A735] hover:bg-[#3d9230] text-white font-semibold transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1
            style={{
              color: "#000000",
              fontWeight: "var(--font-weight-600)",
              fontSize: "var(--font-size-24)",
            }}
            className="text-2xl sm:text-3xl"
          >
            {t("title")}
          </h1>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-[#45A735] hover:text-[#3d9230] font-medium"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-500">
            {t("loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 text-center">
            <Image
              src="/images/notification/notificationpage.png"
              alt={t("empty")}
              width={190}
              height={150}
              className="mb-4"
            />
            <p
              style={{
                color: "#242424",
                fontWeight: "var(--font-weight-600)",
                fontSize: "var(--font-size-16)",
              }}
              className="mb-2"
            >
              {t("empty")}
            </p>
            <p
              style={{
                color: "#484848",
                fontWeight: "var(--font-weight-400)",
                fontSize: "var(--font-size-14)",
              }}
            >
              {t("emptyDesc")}
            </p>
          </div>
        ) : (
          // Bug_40 fix: replaced list-with-divider layout with a stack of
          // cards. Each card has icon + title + body + timestamp + badge,
          // and unread cards have a colored border + tinted background so
          // they stand out at a glance.
          <div className="space-y-3">
            {notifications.map((notification) => {
              const badge = getStatusBadge(notification.type, notification.read);
              const iconBgByType = {
                success: "bg-green-100 text-green-600",
                warning: "bg-yellow-100 text-yellow-600",
                error: "bg-red-100 text-red-600",
                info: "bg-[#F2F9F1] text-[#26472B]",
              };
              return (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  className={`rounded-2xl p-5 shadow-sm transition-all cursor-pointer hover:shadow-md ${
                    notification.read
                      ? "bg-white border border-gray-100"
                      : "bg-[#F2F9F1] border-l-4 border-[#45A735]"
                  }`}
                  onClick={() => handleOpenNotification(notification)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenNotification(notification);
                    }
                  }}
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          iconBgByType[notification.type] || iconBgByType.info
                        }`}
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={
                              notification.type === "success"
                                ? "M5 13l4 4L19 7"
                                : notification.type === "warning"
                                ? "M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                                : notification.type === "error"
                                ? "M6 18L18 6M6 6l12 12"
                                : "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                            }
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3
                          className={`font-semibold ${
                            notification.read
                              ? "text-gray-900"
                              : "text-[#26472B]"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full whitespace-nowrap ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      {notification.message && (
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {notification.message}
                        </p>
                      )}
                      {notification.time && (
                        <p className="text-xs text-gray-400 mt-2">
                          {notification.time}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
