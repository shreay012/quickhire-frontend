"use client";

import React from "react";
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Button,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import { useTranslations, useLocale } from "next-intl";
import { useStepperContext } from "./StepperContext";

// Bug_12 fix: technology `name` may be a string OR an i18n object ({en, hi, …}).
// Render defensively so chips never show "[object Object]" or break the page.
const resolveTechName = (name, locale) => {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name?.[locale] || name?.en || name?.name || "";
};

const ServicesStep = ({ serviceId, selectedService }) => {
  const t = useTranslations("servicesStep");
  const locale = useLocale();
  console.log("ServicesStep received serviceId:", serviceId);
  console.log("ServicesStep received selectedService:", selectedService);

  const {
    selectedTechnologies,
    setSelectedTechnologies,
    setSelectedService: setServiceInContext,
    setHoursBookingData,
    nextStep,
    isFirstStep,
    // Bug_09 fix: restore activeStep on hard refresh.
    activeStep,
    goToStep,
  } = useStepperContext();

  // Bug_09 fix: on first mount, restore activeStep / hoursBookingData /
  // details snapshot from the per-service sessionStorage bucket so a hard
  // refresh keeps the user where they were in the wizard. We only run this
  // once and guard against jumping to a step the snapshot can't support.
  const stepHydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (stepHydratedRef.current) return;
    if (typeof window === "undefined") return;
    if (!serviceId) return;
    stepHydratedRef.current = true;
    try {
      const raw = sessionStorage.getItem(`qh_booking_${serviceId}`);
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (snap?.hoursBookingData && setHoursBookingData) {
        setHoursBookingData(snap.hoursBookingData);
      }
      if (
        Number.isInteger(snap?.activeStep) &&
        snap.activeStep > 0 &&
        typeof goToStep === "function"
      ) {
        goToStep(snap.activeStep);
      }
    } catch {}
  }, [serviceId, setHoursBookingData, goToStep]);

  // Bug_09 fix: mirror activeStep into sessionStorage on every change so the
  // user can refresh at Hours/Summary and land on the same step.
  React.useEffect(() => {
    if (typeof window === "undefined" || !serviceId) return;
    const key = `qh_booking_${serviceId}`;
    try {
      const raw = sessionStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        key,
        JSON.stringify({ ...existing, activeStep })
      );
    } catch {}
  }, [serviceId, activeStep]);

  // Set selectedService in context when component mounts or selectedService changes
  React.useEffect(() => {
    if (selectedService) {
      setServiceInContext(selectedService);
    }
  }, [selectedService, setServiceInContext]);

  // Bug_88 fix: scroll the wizard scroll-container to the top whenever this
  // step mounts so users always start at the heading after step changes.
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // Bug_83 fix: hydrate the green-tick selection from sessionStorage on mount
  // so the user's previously-checked technologies are restored after refresh /
  // navigating back from a later step.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    if (typeof window === "undefined") return;
    const key = serviceId ? `qh_booking_${serviceId}` : null;
    if (!key) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (Array.isArray(snap?.selectedTechnologies) && snap.selectedTechnologies.length) {
        setSelectedTechnologies(snap.selectedTechnologies);
        hydratedRef.current = true;
      }
    } catch {}
  }, [serviceId, setSelectedTechnologies]);

  // Bug_09/83 fix: mirror selected technologies into sessionStorage so
  // refresh / back-nav keeps the green ticks and selected service.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!serviceId) return;
    const key = `qh_booking_${serviceId}`;
    try {
      const raw = sessionStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...existing,
          selectedTechnologies,
          ...(selectedService ? { selectedService } : {}),
        })
      );
    } catch {}
  }, [serviceId, selectedTechnologies, selectedService]);

  // Get technologies from API data — normalize to a stable { _id, name }
  // shape regardless of whether the backend returned strings or objects
  // (some catalogs use `id`, others `_id`).
  // Bug_12 fix: resolve i18n `name` objects to a plain string for rendering.
  const technologies = (selectedService?.technologies || []).map((tech, i) => {
    if (typeof tech === 'string') {
      const id = tech.toLowerCase().replace(/\s+/g, '_');
      return { _id: id, name: tech, _key: `${i}_${id}` };
    }
    const resolvedName = resolveTechName(tech.name, locale);
    const id = tech._id || tech.id || String(resolvedName || '').toLowerCase().replace(/\s+/g, '_');
    return { _id: id, name: resolvedName, _key: `${i}_${id}` };
  });

  const handleToggle = (techId) => {
    setSelectedTechnologies((prev) =>
      prev.includes(techId)
        ? prev.filter((id) => id !== techId)
        : [...prev, techId],
    );
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        py: { xs: 2, sm: 2, md: 3 },
        px: { xs: 2, sm: 3, md: 2 },
        paddingLeft: { xs: 0, sm: 0, md: 0 },
        paddingBottom: { xs: 0, sm: 0, md: 0 },
        pb: 0,

        paddingLeft: { xs: 0, sm: 0, md: 3 },
      }}
    >
      {/* Header */}
      <Typography
        sx={{
          fontSize: { xs: "20px", sm: "24px", md: "24px", lg: "24px" },
          fontWeight: 700,
          color: "#484848",

          pr: 2,
        }}
      >
        {t('title')}
      </Typography>

      {/* Subheading */}
      <Typography
        sx={{
          fontSize: { xs: "14px", sm: "15px", md: "16px" },
          color: "#9CA3AF",
          mb: { xs: 3, md: 2 },
        }}
      >
        {t('subtitle')}
      </Typography>

      {/* Divider Line */}
      <Box
        sx={{
          width: "100%",
          height: "1px",
          backgroundColor: "#E5E7EB",
          mb: { xs: 3, md: 2 },
        }}
      />

      {/* Technologies Grid */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: { xs: 12, sm: 2, md: 2 },
        }}
      >
        {technologies.map((tech) => (
          <FormControlLabel
            key={tech._key}
            control={
              <Checkbox
                checked={selectedTechnologies.includes(tech._id)}
                onChange={() => handleToggle(tech._id)}
                icon={<CheckBoxOutlineBlankIcon sx={{ color: "#45A735" }} />}
                checkedIcon={<CheckBoxIcon sx={{ color: "#45A735" }} />}
                sx={{ mr: 0.5 }}
              />
            }
            label={tech.name}
            sx={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "50px",
              padding: { xs: "4px 10px", sm: "6px 12px", md: "6px 14px" },
              paddingLeft: { xs: "6px", sm: "8px", md: "8px" },
              margin: 0,
              cursor: "pointer",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "#F9FAFB",
                borderColor: "#45A735",
              },
              "& .MuiTypography-root": {
                fontSize: { xs: "14px", sm: "15px", md: "16px" },
                color: "#374151",
                fontWeight: 400,
              },
            }}
          />
        ))}
      </Box>

      {/* Helper Text */}
      <Typography
        sx={{
          fontSize: { xs: "13px", sm: "14px" },
          color: "#9CA3AF",
          mt: 3,
          mb: { xs: 10, sm: 0, md: 0 },
          fontStyle: "italic",
        }}
      >
        {t('helper')}
      </Typography>

      {/* Spacer - Pushes button to bottom */}
      <Box sx={{ flex: 1 }} />

      {/* Continue Button - Sticky at Bottom */}
      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#FFFFFF",

          // padding: { xs: "16px 20px", sm: "20px 24px", md: "24px 32px" },
          paddingTop: { xs: "16px", sm: "20px", md: "24px" },
          paddingBottom: { xs: "16px", sm: "20px", md: "24px" },
          display: "flex",
          justifyContent: "flex-end",
          zIndex: 10,

          paddingRight: { xs: 0, sm: 0, md: 2 },
          // boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.05)",
          boxShadow: "0 -93px 34px rgba(0, 0, 0, 0.05)",
          width: "100%",
          // marginLeft: { xs: "-20px", sm: "-24px", md: "-32px" },
          // marginRight: { xs: "-20px", sm: "-24px", md: "-32px" },
        }}
      >
        <Button
          onClick={() => {
            // Bug_73 fix: guard against advancing with no service selected.
            if (!selectedService) return;
            // Save to localStorage
            if (selectedService) {
              // Build normalized tech objects (same logic as display normalization)
              // Bug_12 fix: resolve i18n `name` objects to a plain string.
              const normalizedTechs = (selectedService.technologies || []).map((tech, i) => {
                if (typeof tech === 'string') {
                  const id = tech.toLowerCase().replace(/\s+/g, '_');
                  return { _id: id, name: tech };
                }
                const resolvedName = resolveTechName(tech.name, locale);
                const id = tech._id || tech.id || String(resolvedName || '').toLowerCase().replace(/\s+/g, '_');
                return { _id: id, name: resolvedName };
              });
              const selectedTechObjects = normalizedTechs.filter((tech) =>
                selectedTechnologies.includes(tech._id),
              );
              const techNames = selectedTechObjects
                .map((tech) => tech.name)
                .join(", ");
              localStorage.setItem("_service_id", selectedService._id);
              localStorage.setItem("_service_name", selectedService.name);
              localStorage.setItem(
                "_selected_tech_ids",
                JSON.stringify(selectedTechnologies),
              );
              localStorage.setItem("_technologies_names", techNames);
            }
            nextStep();
          }}
          // Bug_73 fix: also require a selected service before advancing.
          disabled={selectedTechnologies.length === 0 || !selectedService}
          sx={{
            background: "linear-gradient(to right, #26472B 50%, #45A735 50%)",
            backgroundSize: "200% 100%",
            backgroundPosition: "right bottom",
            color: "#FFFFFF",
            fontSize: { xs: "16px", sm: "16px", md: "16px" },
            fontWeight: 700,
            padding: { xs: "12px 48px", sm: "13px 56px", md: "8px 24px" },
            borderRadius: "12px",
            textTransform: "none",
            boxShadow: "none",
            transition: "background-position 0.3s ease-out",
            "&:hover": {
              backgroundPosition: "left bottom",
              boxShadow: "none",
            },
            "&:disabled": {
              background: "#D1D5DB",
              color: "#9CA3AF",
              cursor: "not-allowed",
            },
          }}
        >
          {t('continue')}
        </Button>
      </Box>
    </Box>
  );
};

export default ServicesStep;
