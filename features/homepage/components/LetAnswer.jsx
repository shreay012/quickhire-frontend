"use client";

import FaqSection from "@/components/common/FaqSection";
import { useTranslationsWithCms, useCmsListOverlay } from "@/lib/hooks/useCmsOverlay";

const LetAnswer = () => {
  const t = useTranslationsWithCms("homepage.faq");

  const fallbackFaqs = [
    { question: t("q1"), answer: t("a1") },
    { question: t("q2"), answer: t("a2") },
    { question: t("q3"), answer: t("a3") },
    { question: t("q4"), answer: t("a4") },
    { question: t("q5"), answer: t("a5") },
  ];
  // CMS list overlay: type=list, key=homepage.faq.items.
  // Each item must shape as { question, answer }.
  const faqs = useCmsListOverlay("homepage.faq.items", fallbackFaqs);

  return <FaqSection title={t("title")} faqs={faqs} />;
};

export default LetAnswer;
