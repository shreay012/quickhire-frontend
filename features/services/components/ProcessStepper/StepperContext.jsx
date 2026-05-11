"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useGuestSession } from "@/lib/hooks/useGuestSession";

const StepperContext = createContext();

// Keys used by individual steps to persist selections
const LS_PENDING = "_pending_booking";

/** Collect everything the guest selected so far into one object */
function buildSnapshot({ selectedService, selectedTechnologies, hoursBookingData, serviceId }) {
  return {
    serviceId: serviceId || (typeof window !== "undefined" ? localStorage.getItem("_service_id") : null),
    serviceName: typeof window !== "undefined" ? localStorage.getItem("_service_name") : null,
    selectedService,
    selectedTechnologies,
    hoursBookingData,
    // individual localStorage keys written by each step
    _selected_tech_ids: typeof window !== "undefined" ? localStorage.getItem("_selected_tech_ids") : null,
    _technologies_names: typeof window !== "undefined" ? localStorage.getItem("_technologies_names") : null,
    _selected_plan: typeof window !== "undefined" ? localStorage.getItem("_selected_plan") : null,
    _selected_date: typeof window !== "undefined" ? localStorage.getItem("_selected_date") : null,
    _selected_time_slot: typeof window !== "undefined" ? localStorage.getItem("_selected_time_slot") : null,
    _selected_assignment_type: typeof window !== "undefined" ? localStorage.getItem("_selected_assignment_type") : null,
    _pricing_data: typeof window !== "undefined" ? localStorage.getItem("_pricing_data") : null,
    savedAt: Date.now(),
  };
}

/** Restore individual localStorage keys from snapshot */
function restoreSnapshot(snap) {
  const keys = [
    "_service_id", "_service_name",
    "_selected_tech_ids", "_technologies_names",
    "_selected_plan", "_selected_date",
    "_selected_time_slot", "_selected_assignment_type",
    "_pricing_data",
  ];
  if (snap.serviceId) localStorage.setItem("_service_id", snap.serviceId);
  if (snap.serviceName) localStorage.setItem("_service_name", snap.serviceName);
  const lsMap = {
    "_selected_tech_ids": snap._selected_tech_ids,
    "_technologies_names": snap._technologies_names,
    "_selected_plan": snap._selected_plan,
    "_selected_date": snap._selected_date,
    "_selected_time_slot": snap._selected_time_slot,
    "_selected_assignment_type": snap._selected_assignment_type,
    "_pricing_data": snap._pricing_data,
  };
  Object.entries(lsMap).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); });
}

export const useStepperContext = () => {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("useStepperContext must be used within StepperProvider");
  }
  return context;
};

export const StepperProvider = ({ children }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [hoursBookingData, setHoursBookingData] = useState(null);
  const [detailsBookingData, setDetailsBookingData] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [isDetailsCompleted, setIsDetailsCompleted] = useState(false);
  const [restoredFromPending, setRestoredFromPending] = useState(false);
  const navigationCallbackRef = useRef(null);
  // Ref for SYNCHRONOUS detection of restoration — readable by child effects in the same flush
  const pendingRestoredRef = useRef(false);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  // Guest session — server-side persistence so refreshes restore state
  const guestSession = useGuestSession();
  const totalSteps = isAuthenticated ? 4 : 5;

  // ─── Restore helper (also callable imperatively from DetailsStep) ───────────
  const _doRestore = useCallback((snap) => {
    restoreSnapshot(snap);
    if (snap.selectedService) setSelectedService(snap.selectedService);
    if (snap.selectedTechnologies?.length) setSelectedTechnologies(snap.selectedTechnologies);
    if (snap.hoursBookingData) setHoursBookingData(snap.hoursBookingData);
    setIsDetailsCompleted(true);
    setActiveStep(2); // → Summary in 4-step auth flow
    pendingRestoredRef.current = true; // synchronous — readable immediately by child effects
    setRestoredFromPending(true);
    localStorage.removeItem(LS_PENDING);
    console.log("✅ Booking state restored from pending snapshot → step 2 (Summary)");
  }, []);

  // ─── On mount (guest only): load server session and restore state ───────────
  useEffect(() => {
    if (typeof window === 'undefined' || isAuthenticated) return;
    (async () => {
      // Ensure session exists (creates one if localStorage has no id yet)
      await guestSession.init();
      const data = await guestSession.load();
      if (!data) return;

      // Restore localStorage keys used by individual steps
      if (data.serviceId)   localStorage.setItem('_service_id', data.serviceId);
      if (data.techIds)     localStorage.setItem('_selected_tech_ids', JSON.stringify(data.techIds));
      if (data.techNames)   localStorage.setItem('_technologies_names', data.techNames);
      if (data.pricingData) localStorage.setItem('_pricing_data', JSON.stringify(data.pricingData));

      // Restore context state from hoursData if available
      if (data.hoursData) {
        setHoursBookingData(data.hoursData);
        if (data.hoursData._selected_plan)           localStorage.setItem('_selected_plan', data.hoursData._selected_plan);
        if (data.hoursData._selected_date)           localStorage.setItem('_selected_date', data.hoursData._selected_date);
        if (data.hoursData._selected_time_slot)      localStorage.setItem('_selected_time_slot', data.hoursData._selected_time_slot);
        if (data.hoursData._selected_assignment_type) localStorage.setItem('_selected_assignment_type', data.hoursData._selected_assignment_type);
      }
      if (data.gstNumber) setGstNumber(data.gstNumber);

      // Jump to the last saved step (capped at Summary so they confirm before proceeding)
      const restoredStep = Math.min(data.step ?? 0, 2);
      if (restoredStep > 0) {
        setActiveStep(restoredStep);
        console.log(`✅ Guest session restored → step ${restoredStep}`);
      }
    })();
  // Only run on initial mount — intentionally empty dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Reactive restore: fires when isAuthenticated changes ──────────────────
  // Also handles already-logged-in users who start a fresh booking (no pending).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;

    const raw = localStorage.getItem(LS_PENDING);

    if (!raw) {
      // User was already authenticated when they opened the booking page.
      // No pending snapshot → just mark details as complete so the 4-step flow renders.
      setIsDetailsCompleted(true);
      return;
    }

    try {
      const snap = JSON.parse(raw);
      if (Date.now() - (snap.savedAt || 0) > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(LS_PENDING);
        setIsDetailsCompleted(true);
        return;
      }
      _doRestore(snap);
    } catch (e) {
      localStorage.removeItem(LS_PENDING);
      setIsDetailsCompleted(true);
    }

    // Claim the guest session → server creates a job and returns its ID
    guestSession.claim().then((result) => {
      if (result?.jobId) {
        localStorage.setItem('_claimed_job_id', result.jobId);
        console.log('✅ Guest session claimed → jobId:', result.jobId);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const setNavigationCallback = (callback) => {
    navigationCallbackRef.current = callback;
  };

  /** Called by DetailsStep before showing OTP/login — saves full guest selection */
  const savePendingBooking = () => {
    if (typeof window === "undefined") return;
    const snap = buildSnapshot({ selectedService, selectedTechnologies, hoursBookingData });
    localStorage.setItem(LS_PENDING, JSON.stringify(snap));
    console.log("💾 Pending booking snapshot saved");
  };

  /**
   * Auto-save pending booking whenever HoursStep completes.
   * Critical: this guarantees _pending_booking exists BEFORE verifyOtp fires
   * and changes isAuthenticated — fixing the restore timing race condition.
   */
  const updateHoursBookingData = useCallback((data) => {
    setHoursBookingData(data);
    if (data && !isAuthenticated && typeof window !== "undefined") {
      const snap = buildSnapshot({ selectedService, selectedTechnologies, hoursBookingData: data });
      localStorage.setItem(LS_PENDING, JSON.stringify(snap));
      console.log("💾 Auto-saved pending booking after HoursStep completed");
    }
  }, [isAuthenticated, selectedService, selectedTechnologies]);

  // Save current booking state to the server-side guest session (best-effort)
  const saveGuestStep = useCallback((extra = {}) => {
    if (isAuthenticated) return;
    const hd = hoursBookingData ? {
      ...hoursBookingData,
      _selected_plan:            typeof window !== 'undefined' ? localStorage.getItem('_selected_plan') : null,
      _selected_date:            typeof window !== 'undefined' ? localStorage.getItem('_selected_date') : null,
      _selected_time_slot:       typeof window !== 'undefined' ? localStorage.getItem('_selected_time_slot') : null,
      _selected_assignment_type: typeof window !== 'undefined' ? localStorage.getItem('_selected_assignment_type') : null,
    } : null;

    guestSession.save({
      step:        activeStep + 1,
      serviceId:   typeof window !== 'undefined' ? localStorage.getItem('_service_id') : null,
      techIds:     (() => { try { return JSON.parse(localStorage.getItem('_selected_tech_ids') || 'null'); } catch { return null; } })(),
      techNames:   typeof window !== 'undefined' ? localStorage.getItem('_technologies_names') : null,
      hoursData:   hd,
      pricingData: (() => { try { return JSON.parse(localStorage.getItem('_pricing_data') || 'null'); } catch { return null; } })(),
      gstNumber:   gstNumber || null,
      ...extra,
    });
  }, [isAuthenticated, activeStep, hoursBookingData, gstNumber, guestSession]);

  const nextStep = () => {
    // Persist to server session before advancing (fire-and-forget)
    saveGuestStep();

    // If there's a navigation callback, call it first
    if (navigationCallbackRef.current) {
      navigationCallbackRef.current(() => {
        if (activeStep < totalSteps - 1) {
          setActiveStep((prev) => prev + 1);
        }
      });
    } else {
      if (activeStep < totalSteps - 1) {
        setActiveStep((prev) => prev + 1);
      }
    }
  };

  const previousStep = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const goToStep = (step) => {
    if (step >= 0 && step < totalSteps) {
      setActiveStep(step);
    }
  };

  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === totalSteps - 1;

  return (
    <StepperContext.Provider
      value={{
        activeStep,
        totalSteps,
        nextStep,
        previousStep,
        goToStep,
        isFirstStep,
        isLastStep,
        setNavigationCallback,
        selectedTechnologies,
        setSelectedTechnologies,
        selectedService,
        setSelectedService,
        isAuthenticated,
        hoursBookingData,
        setHoursBookingData: updateHoursBookingData,
        detailsBookingData,
        setDetailsBookingData,
        termsAccepted,
        setTermsAccepted,
        gstNumber,
        setGstNumber,
        isDetailsCompleted,
        setIsDetailsCompleted,
        savePendingBooking,
        restoredFromPending,
        pendingRestoredRef,
        saveGuestStep,
        claimGuestSession: guestSession.claim,
      }}
    >
      {children}
    </StepperContext.Provider>
  );
};
