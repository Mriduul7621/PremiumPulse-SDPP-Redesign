import { savePdf } from '../lib/savePdf';
import React, { useState, useRef, useMemo } from 'react';
import { 
  X, Printer, Download, Clock, Shield, Sparkles, Check, 
  ArrowRight, CheckCircle2, FileText, User, Calendar, DollarSign,
  TrendingDown, TrendingUp, Info, Scale, BarChart3, Layers
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { CalculationInput, CalculationResult, SDPPResult, PlanFrequency, SDPPPlan } from '../data/types';
import { calculatePremiums, calculateSDPPResult } from '../services/calculator';
import { runSDPPCalculations } from '../services/sdpCalculator';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeClonedDocForPdf } from '../lib/pdfColorSanitizer';

interface TermComparisonModalProps {
  isOpen: boolean;
  embedded?: boolean;
  onClose: () => void;
  input: CalculationInput;
  selectedProduct?: CalculationResult;
  sdppData?: SDPPResult;
  isComboEnabled?: boolean;
  comboSdppPlan?: string;
  comboSdppDeposit?: number;
  comboSdppPaymentMethod?: string;
  currentRules?: any;
  onSelectTerm?: (term: number) => void;
}

export interface TermComparisonItem {
  term: number;
  isCurrent: boolean;
  isApplicable: boolean;
  sumAssured: number;
  monthlyPremium: number;
  quarterlyPremium: number;
  halfYearlyPremium: number;
  yearlyPremium: number;
  singlePremium?: number;
  totalPaid: number; // based on current paymentMethod
  totalPaidYearly: number;
  totalPaidMonthly: number;
  maturityValue: number;
  naturalDeathCover: number;
  accidentalDeathCover: number;
  childStipendMonthly?: number;
  sdpp7Maturity?: number;
  sdpp9Maturity?: number;
  notes?: string;
}

export default function TermComparisonModal({
  isOpen,
  embedded = false,
  onClose,
  input,
  selectedProduct,
  sdppData,
  isComboEnabled,
  comboSdppPlan = 'Elite',
  comboSdppDeposit = 5000,
  comboSdppPaymentMethod = 'Monthly',
  currentRules,
  onSelectTerm
}: TermComparisonModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedDisplayMode, setSelectedDisplayMode] = useState<PlanFrequency>(input.paymentMethod || 'Monthly');
  const printContainerRef = useRef<HTMLDivElement>(null);

  const isSDPP = Boolean(
    selectedProduct?.productId === 'sdpp' || 
    selectedProduct?.productId?.startsWith('sdpp_')
  );
  const isChildPlan = Boolean(selectedProduct?.productId?.startsWith('scep'));
  const childPercentageStr = isChildPlan ? (selectedProduct?.productId?.split('_').pop() || '1') : '0';
  const childPercentage = isChildPlan ? parseInt(childPercentageStr) / 100 : 0;
  const isSinglePremium = selectedProduct?.productId === 'sspe' || selectedProduct?.productId?.startsWith('scep_single_');

  // Determine available terms
  const availableTerms: number[] = useMemo(() => {
    if (currentRules && Array.isArray(currentRules.terms) && currentRules.terms.length > 0) {
      const maxMatAge = currentRules.maxMaturityAge || 70;
      return currentRules.terms.filter((t: number) => (input.age + t) <= maxMatAge);
    }
    if (isSDPP) {
      return Array.from({ length: 21 }, (_, i) => i + 5).filter(t => (input.age + t) <= 70);
    }
    return [10, 12, 15, 18, 20, 25].filter(t => (input.age + t) <= 70);
  }, [currentRules, input.age, isSDPP]);

  // Compute comparison row data across all available terms
  const comparisonData: TermComparisonItem[] = useMemo(() => {
    const selectedProdId = selectedProduct?.productId || 'endowment';

    return availableTerms.map((t) => {
      const isCurrent = t === input.term;

      if (isSDPP) {
        // SDPP Calculation for term t
        const planName = input.sdppPlan || 'Elite';
        const sdppRes = runSDPPCalculations({
          ...input,
          term: t,
          sdppPlan: planName as any,
          targetPremium: input.targetPremium || 5000
        });

        const riderMonthlyTotal = (sdppRes.ciMonthlyPremium || 0) + (sdppRes.hiMonthlyPremium || 0);
        const monthly = (sdppRes.annualPremium / 12) + riderMonthlyTotal;
        const quarterly = (sdppRes.annualPremium / 4) + (riderMonthlyTotal * 3);
        const halfYearly = (sdppRes.annualPremium / 2) + (riderMonthlyTotal * 6);
        const yearly = sdppRes.annualPremium + (riderMonthlyTotal * 12);

        const currentFreqMultiplier = input.paymentMethod === 'Yearly' ? 1 : 
          input.paymentMethod === 'Half-yearly' ? 2 : 
          input.paymentMethod === 'Quarterly' ? 4 : 12;
        
        const modeAmount = input.paymentMethod === 'Yearly' ? yearly :
          input.paymentMethod === 'Half-yearly' ? halfYearly :
          input.paymentMethod === 'Quarterly' ? quarterly : monthly;

        const totalPaid = modeAmount * currentFreqMultiplier * t;
        const totalPaidYearly = yearly * t;
        const totalPaidMonthly = monthly * 12 * t;

        const sdppSumAssured = typeof sdppRes.sumAssured === 'number' ? sdppRes.sumAssured : (sdppRes.annualPremium * t);
        const maturityVal = sdppRes.customMaturity || sdppRes.maturity7 || 0;
        const deathBenefitVal = typeof sdppRes.deathBenefit === 'number' ? sdppRes.deathBenefit : (sdppRes.annualPremium * t);
        const accidentalVal = planName.toLowerCase().includes('prime') 
          ? (2 * sdppSumAssured + totalPaid)
          : (3 * sdppSumAssured);

        return {
          term: t,
          isCurrent,
          isApplicable: sdppRes.errors.length === 0,
          sumAssured: Math.round(sdppSumAssured),
          monthlyPremium: Math.round(monthly),
          quarterlyPremium: Math.round(quarterly),
          halfYearlyPremium: Math.round(halfYearly),
          yearlyPremium: Math.round(yearly),
          totalPaid: Math.round(totalPaid),
          totalPaidYearly: Math.round(totalPaidYearly),
          totalPaidMonthly: Math.round(totalPaidMonthly),
          maturityValue: Math.round(maturityVal),
          naturalDeathCover: Math.round(deathBenefitVal),
          accidentalDeathCover: Math.round(accidentalVal),
          sdpp7Maturity: Math.round(sdppRes.maturity7 || 0),
          sdpp9Maturity: Math.round(sdppRes.maturity9 || 0)
        };
      }

      // Standard / Child Education / Stage Plan
      const resultsForTerm = calculatePremiums({
        ...input,
        term: t
      });

      const prodResult = resultsForTerm.find(r => r.productId === selectedProdId) || resultsForTerm[0];
      const isApplicable = Boolean(prodResult?.isApplicable);

      const monthly = prodResult?.totalPremium?.Monthly || 0;
      const quarterly = prodResult?.totalPremium?.Quarterly || 0;
      const halfYearly = prodResult?.totalPremium?.['Half-yearly'] || 0;
      const yearly = prodResult?.totalPremium?.Yearly || 0;
      const single = prodResult?.totalPremium?.Single || 0;

      let totalPaid = 0;
      if (isSinglePremium) {
        totalPaid = single;
      } else if (input.paymentMethod === 'Yearly') {
        totalPaid = yearly * t;
      } else if (input.paymentMethod === 'Half-yearly') {
        totalPaid = halfYearly * 2 * t;
      } else if (input.paymentMethod === 'Quarterly') {
        totalPaid = quarterly * 4 * t;
      } else {
        totalPaid = monthly * 12 * t;
      }

      const totalPaidYearly = yearly * t;
      const totalPaidMonthly = monthly * 12 * t;
      const saVal = input.sumAssured;
      // All standard policies have sum assured and maturity value same
      const maturityVal = input.sumAssured;
      const childStipendVal = isChildPlan ? input.sumAssured * childPercentage : undefined;
      const naturalDeathVal = input.sumAssured;
      const accidentalDeathVal = input.hasAccidentalProtection ? input.sumAssured * 2 : input.sumAssured;

      return {
        term: t,
        isCurrent,
        isApplicable,
        sumAssured: Math.round(saVal),
        monthlyPremium: Math.round(monthly),
        quarterlyPremium: Math.round(quarterly),
        halfYearlyPremium: Math.round(halfYearly),
        yearlyPremium: Math.round(yearly),
        singlePremium: isSinglePremium ? Math.round(single) : undefined,
        totalPaid: Math.round(totalPaid),
        totalPaidYearly: Math.round(totalPaidYearly),
        totalPaidMonthly: Math.round(totalPaidMonthly),
        maturityValue: Math.round(maturityVal),
        naturalDeathCover: Math.round(naturalDeathVal),
        accidentalDeathCover: Math.round(accidentalDeathVal),
        childStipendMonthly: childStipendVal ? Math.round(childStipendVal) : undefined
      };
    });
  }, [availableTerms, input, selectedProduct, isSDPP, isChildPlan, childPercentage, isSinglePremium]);

  if (!isOpen) return null;

  const currentItem = comparisonData.find(d => d.isCurrent) || comparisonData[0];
  const shortestItem = comparisonData[0];
  const longestItem = comparisonData[comparisonData.length - 1];

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printContainerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // Ensure all web fonts are loaded prior to rasterizing canvas
      if ('fonts' in document) {
        await (document as any).fonts.ready;
      }

      const canvas = await html2canvas(printContainerRef.current, {
        scale: 3, // Crisp high-DPI rendering
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Thoroughly sanitize all modern CSS colors (oklab, oklch, color-mix) in cloned document
          sanitizeClonedDocForPdf(clonedDoc);

          // Force clean, standard typography stack across all elements in the cloned document
          const container = clonedDoc.querySelector('[data-print-container="true"]') as HTMLElement;
          if (container) {
            container.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
            container.style.fontVariantNumeric = 'tabular-nums';
            container.style.setProperty('-webkit-font-smoothing', 'antialiased');
            container.style.width = '794px';
            container.style.maxWidth = '794px';
            container.style.minWidth = '794px';
            container.style.padding = '16px 20px';
            container.style.backgroundColor = '#ffffff';
            container.style.boxShadow = 'none';
            container.style.border = 'none';
            container.style.margin = '0 auto';
            container.style.boxSizing = 'border-box';
          }

          // Hide all screen-only UI elements (.print:hidden) and action columns
          const hiddenEls = clonedDoc.querySelectorAll('.print\\:hidden, [data-pdf-hide="true"]');
          hiddenEls.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });

          // Ensure table fits cleanly
          const table = clonedDoc.querySelector('table') as HTMLElement;
          if (table) {
            table.style.width = '100%';
            table.style.tableLayout = 'auto';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 5;
      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;
      const renderedHeight = (canvas.height * availableWidth) / canvas.width;

      if (renderedHeight <= availableHeight) {
        // Fits on single A4 page with clean margins
        pdf.addImage(imgData, 'PNG', margin, margin, availableWidth, renderedHeight, undefined, 'FAST');
      } else {
        // Uniform scale to guarantee 100% single page fit with no cuts or text slicing
        const scaleFactor = availableHeight / renderedHeight;
        const finalWidth = availableWidth * scaleFactor;
        const xOffset = margin + (availableWidth - finalWidth) / 2;
        pdf.addImage(imgData, 'PNG', xOffset, margin, finalWidth, availableHeight, undefined, 'FAST');
      }

      const planTitle = selectedProduct?.productName || 'Policy';
      const cleanName = (input.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
      await savePdf(pdf, `ShantaLife_Term_Comparison_${cleanName}_${planTitle}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Unable to save PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const planTitle = selectedProduct?.productName || (isSDPP ? `Shanta SDPP (${input.sdppPlan || 'Elite'})` : 'Insurance Policy');
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={embedded ? "w-full" : "fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static print:overflow-visible"}>
      {/* Modal Container */}
      <div className={embedded ? "w-full bg-white rounded-2xl border border-[#e5e8df] overflow-hidden" : "bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none"}>
        
        {/* Top Sticky Header (Hidden in Print) */}
        <div className={embedded ? "hidden" : "p-3 sm:p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0"}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-brand-primary">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                  Policy Term Comparison Matrix
                </h3>
                <span className="bg-brand-primary text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full font-mono">
                  {planTitle}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Compare rates and commitments for SA: <span className="text-brand-primary font-bold">{formatCurrency(input.sumAssured)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition-all border border-slate-700 cursor-pointer shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Content Area */}
        <div className={embedded ? "p-3 sm:p-5 bg-white" : "flex-1 overflow-y-auto p-2 sm:p-5 bg-slate-100 print:p-0 print:bg-white print:overflow-visible"}>
          
          <div 
            ref={printContainerRef} 
            data-print-container="true" 
            className={embedded ? "bg-white space-y-4 w-full" : "bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-[794px] mx-auto print:border-none print:shadow-none print:p-0"}
          >
            
            {/* Printable Official Header */}
            <div className={embedded ? "hidden" : "flex justify-between items-start border-b-2 border-slate-900 pb-2.5"}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-sm">
                  SL
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase leading-none">
                    SHANTA LIFE INSURANCE PLC
                  </h1>
                  <p className="text-[10px] tracking-wider text-slate-600 font-bold uppercase mt-1">
                    Comprehensive Policy Term Comparison Matrix
                  </p>
                </div>
              </div>

              <div className="text-right space-y-0.5">
                <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[9px] uppercase px-2.5 py-0.5 rounded tracking-wider">
                  Official Valuation
                </span>
                <p className="text-xs font-bold text-slate-900">Date: {todayFormatted}</p>
                <p className="text-[10px] text-slate-500 font-medium">Ref: SLC-{Date.now().toString().slice(-6)}</p>
              </div>
            </div>

            {/* Term Comparison Full Matrix Table */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-brand-primary" />
                  All Policy Terms vs Premium Frequency Comparison
                </h4>
                <div className="text-[10px] text-slate-700 font-medium">
                  Sum Assured: <strong className="text-slate-900 font-bold">{formatCurrency(input.sumAssured)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9.5px] font-bold uppercase tracking-wider">
                      <th className="py-1.5 px-2 border-r border-slate-800 text-center w-[11%]">Term</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[12%]">Monthly</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[12%]">Quarterly</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[12%]">Half-Yearly</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[12%]">Yearly</th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right bg-slate-800 w-[15%]">
                        Total Paid ({input.paymentMethod})
                      </th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[13%]">
                        Sum Assured
                      </th>
                      <th className="py-1.5 px-2 border-r border-slate-800 text-right w-[13%]">
                        {isSDPP ? 'Maturity (6.5%-8.5%)' : 'Maturity Value'}
                      </th>
                      <th className="py-1.5 px-2 text-center print:hidden w-16 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comparisonData.map((row) => {
                      const isSelected = row.isCurrent;

                      return (
                        <tr 
                          key={row.term}
                          className={cn(
                            "transition-colors",
                            isSelected 
                              ? "bg-amber-100/90 font-bold border-l-4 border-l-amber-600" 
                              : "hover:bg-slate-50 text-slate-800 even:bg-slate-50/50"
                          )}
                        >
                          {/* Term Column */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <span className={cn("text-xs font-bold", isSelected ? "text-amber-950 font-black" : "text-slate-900")}>
                                {row.term} Yrs
                              </span>
                              {isSelected && (
                                <span className="text-[7.5px] bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Current
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Monthly */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                            <span className={cn("font-bold", isSelected ? "text-slate-950 font-black" : "text-slate-900")}>
                              {formatCurrency(row.monthlyPremium)}
                            </span>
                          </td>

                          {/* Quarterly */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-slate-800">
                            {formatCurrency(row.quarterlyPremium)}
                          </td>

                          {/* Half-Yearly */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-slate-800">
                            {formatCurrency(row.halfYearlyPremium)}
                          </td>

                          {/* Yearly */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-slate-900">
                            {formatCurrency(row.yearlyPremium)}
                          </td>

                          {/* Total Paid over Term */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold bg-slate-50/40">
                            <span className={cn(isSelected ? "text-slate-950 font-black" : "text-slate-900")}>
                              {formatCurrency(row.totalPaid)}
                            </span>
                            <span className="block text-[8px] text-slate-500 font-normal">
                              ({row.term} × {input.paymentMethod})
                            </span>
                          </td>

                          {/* Sum Assured Column */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-slate-900">
                            {formatCurrency(row.sumAssured)}
                          </td>

                          {/* Maturity Benefit */}
                          <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-emerald-800">
                            {isSDPP ? (
                              <div className="space-y-0.5">
                                <div>{formatCurrency(row.sdpp7Maturity || 0)}</div>
                                <div className="text-[8px] text-slate-500 font-normal">to {formatCurrency(row.sdpp9Maturity || 0)}</div>
                              </div>
                            ) : (
                              <div>{formatCurrency(row.maturityValue)}</div>
                            )}
                          </td>

                          {/* Action Button (Hidden in Print) */}
                          <td className="py-1.5 px-2 text-center print:hidden">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-0.5 text-[8.5px] font-bold uppercase text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded">
                                <Check className="w-2.5 h-2.5" /> Selected
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  if (onSelectTerm) {
                                    onSelectTerm(row.term);
                                  }
                                  onClose();
                                }}
                                className="text-[8.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white hover:bg-brand-primary transition-all cursor-pointer shadow-sm active:scale-95"
                              >
                                Apply
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Child Education Stipend / Special Rider Section if applicable */}
            {isChildPlan && (
              <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-2 text-xs flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-700" />
                    Guaranteed Child Education Monthly Stipend ({childPercentageStr}% of SA)
                  </div>
                  <p className="text-[9.5px] text-amber-900 font-medium">
                    Paid upon untimely demise of parent until maturity; remaining future premiums permanently waived.
                  </p>
                </div>
                <div className="font-bold text-amber-950 text-xs shrink-0 bg-white px-2.5 py-1 rounded border border-amber-300">
                  {formatCurrency(input.sumAssured * childPercentage)} / mo
                </div>
              </div>
            )}

            {/* Official Footer / Contact / Sign-off */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-slate-500 text-[9px] font-medium">
              <div>
                <p className="font-black text-slate-800 uppercase tracking-wider text-[9.5px]">Shanta Life Insurance PLC</p>
                <p>Shanta Western Tower, Bir Uttam Mir Shawkat Sarak, Dhaka-1208 | Hotline: 16758 | info@shantalife.com</p>
              </div>

              <div className="text-right space-y-0.5">
                <p className="text-[8.5px] text-slate-400 font-mono">Actuarially Verified Calculation System</p>
                <p className="text-[8px] text-slate-400">Tax rebate up to 10% under Bangladesh Income Tax guidelines.</p>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Modal Action Footer (Hidden in Print) */}
        <div className={embedded ? "hidden" : "p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden shrink-0"}>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Info className="w-3.5 h-3.5 text-brand-primary" />
            <span>Currently viewing: <strong className="text-slate-900">{planTitle} ({input.term} Years)</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1 px-5 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
