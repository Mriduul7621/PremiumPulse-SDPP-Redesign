import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, User, Clock, Shield, Activity, HelpCircle, 
  ChevronDown, Check, X, Info, Phone, Mail, DollarSign, 
  Settings2, ArrowLeftRight, Eye, ListFilter, AlertCircle, Smartphone, UserCircle, Briefcase, CheckCircle2, ShieldAlert,
  ArrowLeft, ArrowRight, ExternalLink, Zap, Home, Sparkles, ChevronRight, CircleUser, Target, PlusCircle, Plus, GraduationCap,
  FileText, Printer, Download, BarChart3, Scale
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { calculatePremiums, calculateSDPPResult, calculateProjection, calculateSAFromPremium } from '../services/calculator';
import { runSDPPCalculations } from '../services/sdpCalculator';
import { CalculationInput, CalculationResult, PlanFrequency, Gender, SDPPResult, ProjectionRow, SDPPPlan } from '../data/types';
import { differenceInYears, parse, format } from 'date-fns';
import PlanQuotationModal from './PlanQuotationModal';
import TermComparisonModal from './TermComparisonModal';

const FREQUENCIES: PlanFrequency[] = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Single'];
const GENDERS: Gender[] = ['Male', 'Female'];

const PLAN_STRUCTURE = [
  { id: 'endowment', name: 'Shanta Endowment Plan' },
  { id: 's3pp', name: 'Shanta 3 Stage Plan' },
  { id: 's4pp', name: 'Shanta 4 Stage Plan' },
  { id: 'sspe', name: 'Shanta Single Premium Endowment' },
  { id: 'scep_1', name: 'Shanta Child Education Plan (1%)' },
  { id: 'scep_2', name: 'Shanta Child Education Plan (2%)' },
  { id: 'scep_3', name: 'Shanta Child Education Plan (3%)' },
  { id: 'scep_single_1', name: 'Shanta Child Education Plan Single Payment (1%)' },
  { id: 'scep_single_2', name: 'Shanta Child Education Plan Single Payment (2%)' },
  { id: 'scep_single_3', name: 'Shanta Child Education Plan Single Payment (3%)' },
  { id: 'sdpp', name: "Shanta Depositor's Protection Plan" }
];

const SDPP_PLANS: { id: string; name: string }[] = [
  { id: 'Elite', name: 'Elite' },
  { id: 'Signature', name: 'Signature' },
  { id: 'Prime', name: 'Prime' }
];

const PLAN_RULES: Record<string, any> = {
  sdpp_Elite: {
    minAge: 18,
    maxAge: 50,
    maxMaturityAge: 60,
    terms: Array.from({ length: 21 }, (_, i) => i + 5), // 5 to 25
    minPremium: 4000
  },
  sdpp_Signature: {
    minAge: 18,
    maxAge: 60,
    maxMaturityAge: 70,
    terms: Array.from({ length: 21 }, (_, i) => i + 5), // 5 to 25
    minPremium: 2000
  },
  sdpp_Prime: {
    minAge: 18,
    maxAge: 60,
    maxMaturityAge: 70,
    terms: Array.from({ length: 21 }, (_, i) => i + 5), // 5 to 25
    minPremium: 2000
  },
  endowment: {
    minAge: 0,
    maxAge: 60,
    maxMaturityAge: 70,
    terms: Array.from({ length: 16 }, (_, i) => i + 10), // 10 to 25
    minSA: 100000
  },
  s3pp: {
    minAge: 0,
    maxAge: 60,
    maxMaturityAge: 72,
    terms: [12, 15, 18, 21, 24, 27],
    minSA: 100000
  },
  s4pp: {
    minAge: 0,
    maxAge: 60,
    maxMaturityAge: 72,
    terms: [12, 16, 20, 24, 28],
    minSA: 100000
  },
  sspe: {
    minAge: 18,
    maxAge: 55,
    maxMaturityAge: 65,
    terms: Array.from({ length: 16 }, (_, i) => i + 5), // 5 to 20
    minPremium: 50000
  },
  scep: { // Base for all SCEP regular
    minAge: 21, // Parent age
    maxAge: 55,
    maxMaturityAge: 65,
    terms: Array.from({ length: 11 }, (_, i) => i + 10), // 10 to 20
    minSA: 100000
  },
  scep_single: { // Base for all SCEP single
    minAge: 21,
    maxAge: 55,
    maxMaturityAge: 65,
    terms: Array.from({ length: 11 }, (_, i) => i + 10),
    minPremium: 300000
  }
};

const INITIAL_INPUT: CalculationInput = {
  dob: '',
  age: 0,
  childDob: '',
  childAge: 0,
  term: 0,
  sumAssured: 0,
  gender: '' as Gender,
  paymentMethod: '' as PlanFrequency,
  hasAccidentalProtection: false,
  hasCIClassic: false,
  hasCIStandard: false,
  income: 500000,
  targetPremium: 0,
  inputMode: '' as 'SumAssured' | 'Premium',
  name: '',
  email: '',
  phone: '',
  monthlyPremium: 0,
  dailyHospitalCoverage: 0,
  ciCoverage: undefined,
  sdppPlan: 'Elite',
  issueDate: new Date().toISOString().split('T')[0],
};

export default function Calculator() {
  const [input, setInput] = useState<CalculationInput>(INITIAL_INPUT);

  const [appState, setAppState] = useState<'home' | 'inputs' | 'results'>('home');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Combo SDPP state
  const [isComboEnabled, setIsComboEnabled] = useState<boolean>(false);
  const [comboSdppPlan, setComboSdppPlan] = useState<SDPPPlan | ''>('');
  const [comboSdppPaymentMethod, setComboSdppPaymentMethod] = useState<PlanFrequency>('Monthly');
  const [comboSdppDeposit, setComboSdppDeposit] = useState<number>(0);
  const [comboSdppDailyHospitalCoverage, setComboSdppDailyHospitalCoverage] = useState<number>(0);
  const [comboSdppCustomRate, setComboSdppCustomRate] = useState<number | ''>('');

  // Sync combo payment mode with primary policy payment mode
  useEffect(() => {
    if (isComboEnabled) {
      const mode = input.paymentMethod === 'Single' ? 'Yearly' : (input.paymentMethod || 'Monthly');
      setComboSdppPaymentMethod(mode);
    }
  }, [input.paymentMethod, isComboEnabled]);

  const handleComboToggle = (enabled: boolean) => {
    setIsComboEnabled(enabled);
    if (enabled) {
      setComboSdppPlan('' as SDPPPlan);
      setComboSdppDeposit(0);
      setComboSdppDailyHospitalCoverage(0);
      setComboSdppCustomRate('');
      const mode = input.paymentMethod === 'Single' ? 'Yearly' : (input.paymentMethod || 'Monthly');
      setComboSdppPaymentMethod(mode);
    }
  };

  const handleReset = () => {
    setInput(INITIAL_INPUT);
    setValidationErrors({});
    setSelectedProductId('');
    setIsComboEnabled(false);
    setComboSdppPlan('' as SDPPPlan);
    setComboSdppDeposit(0);
    setComboSdppDailyHospitalCoverage(0);
    setComboSdppCustomRate('');
  };
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [previewSection, setPreviewSection] = useState<'quotation' | 'term' | 'policy' | 'liquidity'>('quotation');
  const [liquidityDetails, setLiquidityDetails] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState<boolean>(false);
  const [showTermComparisonModal, setShowTermComparisonModal] = useState<boolean>(false);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [isEditingSA, setIsEditingSA] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPlanMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Scroll to top when state changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [appState]);

  useEffect(() => {
    if (!input.dob) return;
    try {
      const birthDate = parse(input.dob, 'yyyy-MM-dd', new Date());
      const referenceDate = input.issueDate ? parse(input.issueDate, 'yyyy-MM-dd', new Date()) : new Date();
      // Simplified age calculation matching the website's logic (Year difference)
      const age = referenceDate.getFullYear() - birthDate.getFullYear();

      if (!isNaN(age) && age >= 0 && age < 100) {
        setInput(prev => ({ ...prev, age }));
      }
    } catch (e) {}
  }, [input.dob, input.issueDate]);


  const results = useMemo(() => {
    const standard = calculatePremiums(input);
    const sdpp = calculateSDPPResult({
      ...input,
      // For calculation engine, we use the combined ID if needed or just pass as is
    });
    return [...standard, ...sdpp];
  }, [input]);
  const selectedProduct = useMemo(() => results.find(r => {
    if (selectedProductId === 'sdpp') {
      return r.productId === `sdpp_${input.sdppPlan?.toLowerCase()}`;
    }
    return r.productId === selectedProductId;
  }), [results, selectedProductId, input.sdppPlan]);
  const isSDPP = useMemo(() => selectedProductId === 'sdpp', [selectedProductId]);
  const isSinglePremiumProduct = useMemo(() => selectedProductId === 'sspe' || selectedProductId.startsWith('scep_single_'), [selectedProductId]);
  const sdppData: SDPPResult | undefined = (selectedProduct as any)?.sdppData;
  const currentRules = useMemo(() => {
    if (selectedProductId.startsWith('scep_single_')) return PLAN_RULES.scep_single;
    if (selectedProductId.startsWith('scep_')) return PLAN_RULES.scep;
    if (selectedProductId === 'sdpp') return PLAN_RULES[`sdpp_${input.sdppPlan}`];
    return PLAN_RULES[selectedProductId] || PLAN_RULES.endowment;
  }, [selectedProductId, input.sdppPlan]);

  useEffect(() => {
    if (isSDPP && input.inputMode !== 'Premium') {
      setInput(prev => ({ ...prev, inputMode: 'Premium' }));
    }
  }, [isSDPP, input.inputMode]);

  const validateInputs = () => {
    const errors: Record<string, string> = {};
    const { age, term, sumAssured, targetPremium, inputMode } = input;

    // Only validate if product is selected
    if (selectedProductId) {
      if (age > 0) {
        if (age < currentRules.minAge) errors.age = `Minimum entry age for selected plan is ${currentRules.minAge} years.`;
        if (age > currentRules.maxAge) errors.age = `Maximum entry age for selected plan is ${currentRules.maxAge} years.`;
      }

      if (age > 0 && term > 0 && (age + term > currentRules.maxMaturityAge)) {
        errors.term = `Total age at maturity (${age + term}) exceeds limit of ${currentRules.maxMaturityAge} years.`;
      }

      if (term > 0) {
        if (inputMode === 'SumAssured' && sumAssured > 0) {
          if (currentRules.minSA && sumAssured < currentRules.minSA) {
            errors.sumAssured = `Minimum Sum Assured is ${formatCurrency(currentRules.minSA)}.`;
          }
        } else if (inputMode === 'Premium' && targetPremium > 0) {
          if (isSinglePremiumProduct && currentRules.minPremium && targetPremium < currentRules.minPremium) {
            errors.targetPremium = `Minimum Single Premium is ${formatCurrency(currentRules.minPremium)}.`;
          } else if (!isSinglePremiumProduct && !isSDPP) {
            const minSAResult = calculatePremiums({ 
              ...input, 
              inputMode: 'SumAssured', 
              sumAssured: currentRules.minSA || 100000,
              hasAccidentalProtection: false,
              hasCIClassic: false,
              hasCIStandard: false
            }).find(r => r.productId === selectedProductId);
            
            const minRequiredPremium = minSAResult ? (minSAResult.totalPremium?.[input.paymentMethod] || 5000) : 5000;

            if (targetPremium < minRequiredPremium) {
              errors.targetPremium = `Minimum Premium for ${formatCurrency(currentRules.minSA || 100000)} Sum Assured is ${formatCurrency(minRequiredPremium)}.`;
            }
          } else if (isSDPP) {
            const modeFactor = input.paymentMethod === 'Yearly' ? 12 : 
                               input.paymentMethod === 'Half-yearly' ? 6 : 
                               input.paymentMethod === 'Quarterly' ? 3 : 1;
            const modeMinPremium = currentRules.minPremium * modeFactor;
            if (targetPremium < modeMinPremium) {
              errors.targetPremium = `Minimum ${input.paymentMethod} Deposit is ${formatCurrency(modeMinPremium)}.`;
            }
          }
        }
      }
    }

    if (isComboEnabled && age > 0 && term > 0) {
      if (age < 18 || age > 60) {
        errors.comboSdpp = "SDPP Combo cannot be added as entry age must be between 18 and 60 years.";
      } else if (comboSdppPlan) {
        if (comboSdppPlan === 'Elite' && age > 50) {
          errors.comboSdpp = "Maximum entry age for SDPP Elite plan is 50 years.";
        } else if (comboSdppPlan === 'Elite' && age + term > 60) {
          errors.comboSdpp = `Maximum maturity age for SDPP Elite plan is 60 (Current: ${age + term}).`;
        } else if ((comboSdppPlan === 'Signature' || comboSdppPlan === 'Prime') && age + term > 70) {
          errors.comboSdpp = `Maximum maturity age for SDPP ${comboSdppPlan} plan is 70 (Current: ${age + term}).`;
        }

        const comboModeBase = comboSdppPlan === 'Elite' ? 4000 : 2000;
        const comboModeFactor = comboSdppPaymentMethod === 'Yearly' ? 12 : 
                                comboSdppPaymentMethod === 'Half-yearly' ? 6 : 
                                comboSdppPaymentMethod === 'Quarterly' ? 3 : 1;
        const comboMinDeposit = comboModeBase * comboModeFactor;

        if (comboSdppDeposit > 0 && comboSdppDeposit < comboMinDeposit) {
          errors.comboSdppDeposit = `Minimum ${comboSdppPaymentMethod} Deposit for SDPP ${comboSdppPlan} is ${formatCurrency(comboMinDeposit)}.`;
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    validateInputs();
  }, [input.age, input.term, input.sumAssured, input.targetPremium, input.inputMode, input.paymentMethod, selectedProductId, currentRules, isComboEnabled, comboSdppPlan, comboSdppDailyHospitalCoverage, comboSdppDeposit, comboSdppPaymentMethod]);

  useEffect(() => {
    if (isSinglePremiumProduct) {
      setInput(prev => ({ ...prev, paymentMethod: 'Single' }));
    } else if (input.paymentMethod === 'Single') {
      setInput(prev => ({ ...prev, paymentMethod: 'Yearly' }));
    }
  }, [selectedProductId, isSinglePremiumProduct]);

  useEffect(() => {
    // Ensure term is valid for the product if already selected
    if (input.term !== 0 && !currentRules.terms.includes(input.term)) {
        setInput(prev => ({ ...prev, term: 0 }));
    }
  }, [selectedProductId, currentRules]);

  const handleInputChange = (field: keyof CalculationInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  // Sync monthly premium and sum assured for SDPP/Standard bridge
  useEffect(() => {
    if (isSDPP && input.monthlyPremium) {
       // Calculation engine handles it, but for UI consistency let's update SA display
       const estimatedSA = (input.monthlyPremium * (input.paymentMethod === 'Monthly' ? 12 : 12)) * input.term; // simplified
       // Actually let's let the engine handle it and just show it in the results
    }
  }, [input.monthlyPremium, isSDPP]);

  // Reverse calculation for Premium mode
  useEffect(() => {
    if (input.inputMode === 'Premium' && !isSDPP) {
      const newSA = calculateSAFromPremium(input, selectedProductId);
      if (newSA !== input.sumAssured && newSA > 0) {
        setInput(prev => ({ ...prev, sumAssured: newSA }));
      }
    }
  }, [input.targetPremium, input.inputMode, input.paymentMethod, input.age, input.term, input.hasAccidentalProtection, input.hasCIClassic, input.hasCIStandard, selectedProductId, isSDPP]);

  const getMaturitySchedule = (productId: string) => {
    const year = new Date().getFullYear();
    const fa = isSDPP ? (typeof sdppData?.sumAssured === 'number' ? sdppData.sumAssured : input.sumAssured) : input.sumAssured;
    const term = input.term;

    if (productId === 's3pp') {
      return [
        { year: year + Math.round(term / 3), amount: fa * 0.25, label: '1/3 of the policy term' },
        { year: year + Math.round(2 * term / 3), amount: fa * 0.25, label: '2/3 of the policy term' },
        { year: year + term, amount: fa * 0.50, label: 'Remaining Sum Assured' },
      ];
    } else if (productId === 's4pp') {
      return [
        { year: year + Math.round(term / 4), amount: fa * 0.15, label: '1st Stage' },
        { year: year + Math.round(2 * term / 4), amount: fa * 0.15, label: '2nd Stage' },
        { year: year + Math.round(3 * term / 4), amount: fa * 0.15, label: '3rd Stage' },
        { year: year + term, amount: fa * 0.55, label: 'Final Maturity' },
      ];
    } else if (productId.startsWith('sdp') || productId === 's5pp') {
      return [
        { year: year + Math.round(term / 5), amount: fa * 0.10, label: 'Stage 1 (10%)' },
        { year: year + Math.round(2 * term / 5), amount: fa * 0.15, label: 'Stage 2 (15%)' },
        { year: year + Math.round(3 * term / 5), amount: fa * 0.20, label: 'Stage 3 (20%)' },
        { year: year + Math.round(4 * term / 5), amount: fa * 0.25, label: 'Stage 4 (25%)' },
        { year: year + term, amount: fa * 0.30, label: 'Maturity (30%)' },
      ];
    }
    return [{ year: year + term, amount: fa, label: 'Maturity Value' }];
  };

  const getDeathBenefits = () => {
    if (isSDPP && sdppData) {
      const primaryCiAmt = (input.hasCIClassic || input.hasCIStandard) ? Math.min(input.sumAssured * 0.5, 3000000) : 0;
      const sdppCiAmt = sdppData.ciCoverage || 0;
      const totalCiAmt = primaryCiAmt + sdppCiAmt;

      const sdppAdbRider = sdppData.accidentalBenefit || 0;
      const sdppMainSa = typeof sdppData.deathBenefit === 'number' ? sdppData.deathBenefit : 0;
      const sdppAccidentalDeathTotal = sdppAdbRider + sdppMainSa;

      const sdppBenefits = [
        { label: 'Death Benefit', value: typeof sdppData.deathBenefit === 'string' ? sdppData.deathBenefit : formatCurrency(sdppData.deathBenefit), desc: 'AV or Total Basic Premium' },
        { label: 'Accidental Death Benefit', value: formatCurrency(sdppAccidentalDeathTotal), desc: '2x SDPP SA + SDPP Main SA' },
        { label: 'Accidental Permanent Partial Disability', value: formatCurrency(sdppAdbRider), desc: '2x SDPP Main Sum Assured' },
      ];

      if (primaryCiAmt > 0 && sdppCiAmt > 0) {
        sdppBenefits.push(
          { label: 'Primary Policy CI Benefit', value: formatCurrency(primaryCiAmt), desc: '50% of SA (Max 30L)' },
          { label: 'SDPP Critical Illness', value: formatCurrency(sdppCiAmt), desc: 'SDPP Plan Coverage' },
          { label: 'Total Critical Illness', value: formatCurrency(totalCiAmt), desc: 'Primary Rider + SDPP Combined' }
        );
      } else if (sdppCiAmt > 0) {
        sdppBenefits.push({ label: 'Critical Illness', value: formatCurrency(sdppCiAmt), desc: 'Lump sum payment' });
      } else if (primaryCiAmt > 0) {
        sdppBenefits.push({ label: 'Primary Policy CI Benefit', value: formatCurrency(primaryCiAmt), desc: '50% of SA (Max 30L)' });
      }

      sdppBenefits.push({ label: 'Hospital Coverage', value: formatCurrency(sdppData.hospitalCoverage), desc: 'Limit per event' });
      return sdppBenefits;
    }
    const fa = input.sumAssured;
    const baseBenefit = selectedProductId === 'sspe' ? (selectedProduct as any)?.maturityValue || fa : fa;
    const accidentalBenefit = input.sumAssured * 2;
    const ciBenefit = Math.min(fa * 0.5, 3000000); // Max 30 Lac
    
    const benefits = [
      { 
        label: selectedProductId === 'sspe' ? 'Survival / Death Benefit' : 'Natural Death Benefit', 
        value: formatCurrency(baseBenefit), 
        desc: selectedProductId === 'sspe' ? 'Guaranteed Maturity / Life Cover' : 'Paid as Sum Assured' 
      },
    ];

    if (input.hasAccidentalProtection) {
      benefits.push({ label: 'Accidental Death Benefit', value: formatCurrency(accidentalBenefit), desc: '200% Payout Benefit' });
    }

    if (selectedProductId.startsWith('scep')) {
      const pStr = selectedProductId.split('_').pop() || '1';
      const percentage = parseInt(pStr) / 100;
      benefits.push({ 
        label: 'Education Support Stipend', 
        value: `${formatCurrency(fa * percentage)} / Month`, 
        desc: `Monthly payment (${pStr}% of SA) until plan maturity` 
      });
      benefits.push({
        label: 'Education Maturity Benefit',
        value: formatCurrency(fa),
        desc: 'Paid at maturity even after stipend starts'
      });
    }

    if (input.hasCIClassic || input.hasCIStandard) {
      benefits.push({ label: 'Critical Illness Benefit', value: formatCurrency(ciBenefit), desc: '50% of SA (Max 30L)' });
    }

    return benefits;
  };

  const taxRebate = (isSinglePremiumProduct ? (selectedProduct?.totalPremium.Single || 0) : (selectedProduct?.totalPremium.Yearly || 0)) * 0.10;

  // SDPP Combo calculation
  const sdppComboData = useMemo(() => {
    if (!isComboEnabled || comboSdppDeposit <= 0) return null;
    const comboInput: CalculationInput = {
      ...input,
      sdppPlan: comboSdppPlan,
      paymentMethod: comboSdppPaymentMethod,
      monthlyPremium: comboSdppPaymentMethod === 'Monthly' ? comboSdppDeposit : comboSdppDeposit / 12,
      targetPremium: comboSdppDeposit,
      sumAssured: comboSdppDeposit * (comboSdppPaymentMethod === 'Yearly' ? 1 : comboSdppPaymentMethod === 'Half-yearly' ? 2 : comboSdppPaymentMethod === 'Quarterly' ? 4 : 12) * input.term,
      inputMode: 'Premium',
      dailyHospitalCoverage: comboSdppDailyHospitalCoverage,
      customInterestRate: comboSdppCustomRate !== '' ? Number(comboSdppCustomRate) : undefined,
    };
    return runSDPPCalculations(comboInput);
  }, [isComboEnabled, input, comboSdppPlan, comboSdppPaymentMethod, comboSdppDeposit, comboSdppDailyHospitalCoverage, comboSdppCustomRate]);

  const projectionData = useMemo(() => {
    if (isSDPP && sdppData) return sdppData.projection;
    return calculateProjection(input, selectedProductId);
  }, [input, selectedProductId, isSDPP, sdppData]);

  // Sub-renderers
  const renderHome = () => (
    <div className="relative min-h-[calc(100dvh-76px)] w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#f7f8ef] via-white to-[#eeefda]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-20 w-full max-w-4xl px-5 text-center space-y-7 py-16"
      >
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold text-brand-text tracking-tight leading-tight">
            Premium<span className="text-brand-primary">Pulse</span>
          </h1>
        </div>

        <div className="flex justify-center pt-12 md:pt-8">
          <button 
            onClick={() => setAppState('inputs')}
            className="w-full max-w-[280px] md:max-w-xs py-3.5 md:py-4 bg-brand-primary text-white font-semibold tracking-wide rounded-xl hover:bg-[#81771c] transition-all flex items-center justify-center gap-3 group shadow-sm text-sm md:text-base"
          >
            Start Valuation
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-[10px] md:text-xs text-slate-600 font-medium tracking-wide pt-6 md:pt-10">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-brand-primary" /> Instant Results
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-brand-primary" /> Secure Data
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-brand-primary" /> Live Valuation
          </div>
        </div>
      </motion.div>
    </div>
  );

  const renderInputs = () => {
    const primaryPayable = selectedProduct?.totalPremium?.[input.paymentMethod] || 0;
    const totalPayableAmount = isComboEnabled ? primaryPayable + (comboSdppDeposit || 0) : primaryPayable;

    // Progressive Step Completion Flags
    const isStep1Complete = Boolean(input.dob && input.gender && input.age > 0);
    const isStep2Complete = Boolean(isStep1Complete && selectedProductId);
    const isStep3Complete = Boolean(isStep2Complete && (
      isSDPP 
        ? Boolean(input.sdppPlan)
        : Boolean(input.inputMode)
    ));
    const isStep4Complete = Boolean(isStep3Complete && (
      isSDPP 
        ? Boolean(input.term > 0)
        : Boolean(input.paymentMethod || isSinglePremiumProduct)
    ));
    const isStep5Complete = Boolean(isStep4Complete && (
      isSDPP 
        ? Boolean(input.paymentMethod)
        : Boolean(input.term > 0)
    ));
    const isStep6Complete = Boolean(isStep5Complete && (
      isSDPP 
        ? Boolean(input.targetPremium && input.targetPremium > 0 && (input.sdppPlan !== 'Elite' || (input.dailyHospitalCoverage && input.dailyHospitalCoverage >= 1000)))
        : ((input.inputMode === 'SumAssured' && input.sumAssured > 0) || (input.inputMode === 'Premium' && input.targetPremium > 0))
    ));

    // Combo Progressive Step Completion Flags
    const isComboStep1Complete = Boolean(comboSdppPlan);
    const isComboStep2Complete = Boolean(isComboStep1Complete && comboSdppDeposit > 0);
    const isComboStep3Complete = Boolean(
      isComboStep2Complete && (comboSdppPlan !== 'Elite' || comboSdppDailyHospitalCoverage > 0)
    );
    const isComboFullyComplete = !isComboEnabled || isComboStep3Complete;

    return (
      <div className="w-full max-w-5xl lg:max-w-7xl 2xl:max-w-[1550px] mx-auto space-y-4 my-auto">
        {/* Full Screen / Full Width White Card Container */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-[#e5e8df] shadow-sm p-4 sm:p-6 md:p-8 space-y-5 transition-all duration-300 text-brand-text">
          
          {/* Header & Sample-style Radio Selector at Top */}
          <div className="space-y-4 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setAppState('home')}
                  className="p-2 sm:p-2.5 rounded-full bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all cursor-pointer flex-shrink-0 text-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-base sm:text-lg md:text-2xl font-bold text-brand-text tracking-tight leading-tight">
                    Plan Configuration Calculator
                  </h2>
                  <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-500 font-medium tracking-normal mt-1">
                    Personalize your coverage strategy & parameters
                  </p>
                </div>
              </div>

              {isComboEnabled && (
                <div className="hidden sm:flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-3 py-1.5 rounded-full">
                  <Sparkles className="w-4 h-4 text-brand-primary animate-pulse" />
                  <span className="text-[10px] md:text-xs font-black uppercase text-brand-primary tracking-wider">Dual-Policy Combo</span>
                </div>
              )}
            </div>

            {/* Radio Selectors inspired by the GPA Calculator Sample */}
            <div className="flex flex-wrap items-center gap-6 pt-1 text-xs sm:text-sm font-bold text-slate-700">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="radio"
                  name="calculatorGoalRadio"
                  checked={!isComboEnabled}
                  onChange={() => handleComboToggle(false)}
                  className="w-4 h-4 text-brand-primary accent-brand-primary cursor-pointer"
                />
                <span className="group-hover:text-brand-primary transition-colors">Calculate Primary Plan Only</span>
              </label>

              {!isSDPP && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="radio"
                    name="calculatorGoalRadio"
                    checked={isComboEnabled}
                    onChange={() => handleComboToggle(true)}
                    className="w-4 h-4 text-brand-primary accent-brand-primary cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 group-hover:text-brand-primary transition-colors">
                    Calculate Dual-Policy Combo Package
                    <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
                  </span>
                </label>
              )}
            </div>
          </div>

          <nav aria-label="Configuration steps" className="grid grid-cols-3 gap-2 rounded-xl border border-[#e5e8df] bg-[#f8f9f3] p-2">{(['Personal','Plan','Riders'] as const).map((name,index)=><button key={name} type="button" disabled={index===1&&!isStep1Complete || index===2&&!isStep6Complete} onClick={()=>setWizardStep((index+1) as 1|2|3)} className={cn('rounded-lg py-3 text-xs font-semibold disabled:opacity-40',wizardStep===index+1?'bg-brand-primary text-white shadow-sm':'text-brand-text hover:bg-white')}>{index+1}. {name}</button>)}</nav>
          {/* Grid Layout for Policy Inputs */}
          <div className={cn(
            "grid grid-cols-1 gap-5 lg:gap-8 items-start transition-all duration-500",
            isComboEnabled ? "lg:grid-cols-12" : "w-full"
          )}>
            {/* LEFT COLUMN: Policy 1 / Primary Plan Configuration */}
            <div className={cn(
              "space-y-4 sm:space-y-5",
              isComboEnabled ? "lg:col-span-6 2xl:col-span-7" : "w-full"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-xs">
                    P1
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest block">Policy 1</span>
                    <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-wider">
                      {selectedProduct?.productName || "Primary Plan Configuration"}
                    </h3>
                  </div>
                </div>
                {input.term > 0 && (
                  <span className="text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                    Term: {input.term} Yrs
                  </span>
                )}
              </div>

              <div className={wizardStep === 1 ? 'space-y-4' : 'hidden'}>
              {/* STEP 1: IDENTITY (Gender, DOB, Age) & Issue Date */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                isStep1Complete 
                  ? "bg-emerald-50/30 border-emerald-300/80" 
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep1Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep1Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "1"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      Issue Date, Gender & Age
                    </h4>
                  </div>
                  {isStep1Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  {/* Issue Date */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brand-primary" /> Issue Date
                    </label>
                    <input
                      type="date"
                      value={input.issueDate}
                      onChange={(e) => handleInputChange('issueDate', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-full px-3 py-2 text-xs font-bold text-slate-800 focus:border-brand-primary outline-none transition-all"
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <CircleUser className="w-3 h-3 text-brand-primary" /> Gender
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {GENDERS.map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleInputChange('gender', g)}
                          className={cn(
                            "py-2 px-1.5 rounded-full border text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center",
                            input.gender === g
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {g === 'Male' ? '♂ ' : '♀ '}{g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DOB */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brand-primary" /> {selectedProductId.startsWith('scep_') ? "Parent DOB" : "Date of Birth"}
                    </label>
                    <input
                      type="date"
                      value={input.dob}
                      onChange={(e) => handleInputChange('dob', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-full px-3 py-2 text-xs font-bold text-slate-800 focus:border-brand-primary outline-none transition-all"
                    />
                  </div>

                  {/* Calculated Age */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3 text-brand-primary" /> Age
                    </label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-full px-3 py-2 text-xs font-mono font-black text-slate-900 flex items-center justify-between">
                      <span>{input.age ? `${input.age} Yrs` : 'Select DOB'}</span>
                    </div>
                    {validationErrors.age && <p className="text-[10px] text-red-500 font-bold italic">{validationErrors.age}</p>}
                  </div>
                </div>
              </div>

              </div>
              <div className={wizardStep === 2 ? 'space-y-4' : 'hidden'}>
              {/* STEP 2: PRODUCT SELECTION */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                !isStep1Complete
                  ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                  : isStep2Complete
                  ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep2Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep2Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "2"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      Insurance Product Selection
                    </h4>
                  </div>
                  {!isStep1Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Complete Step 1 First</span>}
                  {isStep2Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                <div className="relative group" ref={menuRef}>
                  <button
                    type="button"
                    disabled={!isStep1Complete}
                    onClick={() => setShowPlanMenu(!showPlanMenu)}
                    className="w-full bg-white border border-slate-200 rounded-full px-5 py-2.5 text-xs sm:text-sm font-black text-slate-900 flex items-center justify-between group hover:border-brand-primary focus:bg-white transition-all text-left shadow-sm cursor-pointer"
                  >
                    <span className={cn("pr-2 line-clamp-1", !selectedProduct && "text-slate-400 font-medium italic")}>
                      {selectedProduct?.productName || "-- Select Insurance Product --"}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 group-hover:text-brand-primary transition-all flex-shrink-0", showPlanMenu && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {showPlanMenu && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-full mt-2 right-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] py-2 max-h-[300px] overflow-y-auto custom-scrollbar"
                      >
                        <div className="px-5 py-1">
                          <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-1">Select A Product Plan</h4>
                        </div>
                        <div className="space-y-0.5">
                          {PLAN_STRUCTURE.map((item) => {
                            const isSelected = selectedProductId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => { 
                                  if (item.id === 'sdpp') {
                                    window.location.assign('https://sdpp-value-projection.vercel.app/');
                                    return;
                                  }
                                  setSelectedProductId(item.id);
                                  setShowPlanMenu(false);
                                  if (item.id === 'sspe' || item.id === 'scep_single') {
                                    handleInputChange('paymentMethod', 'Single');
                                  }
                                }}
                                className={cn(
                                  "w-full px-5 py-2.5 text-left transition-all flex items-center justify-between group/item cursor-pointer text-xs font-semibold",
                                  isSelected 
                                    ? "bg-brand-primary text-white font-bold" 
                                    : "text-slate-700 hover:bg-slate-50 hover:text-brand-primary"
                                )}
                              >
                                <span>{item.name}</span>
                                {isSelected && <Check className="w-4 h-4 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* STEP 3: CALCULATION GOAL / SDPP PLAN CATEGORY */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                !isStep2Complete
                  ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                  : isStep3Complete
                  ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep3Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep3Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "3"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      {isSDPP ? "SDPP Plan Category" : "Calculation Goal"}
                    </h4>
                  </div>
                  {!isStep2Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Select Product First</span>}
                  {isStep3Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                {!isSDPP ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!isStep2Complete}
                      onClick={() => handleInputChange('inputMode', 'SumAssured')}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-[11px] font-bold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm",
                        input.inputMode === 'SumAssured' 
                          ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Shield className="w-3.5 h-3.5" /> <span className="sm:hidden">Sum Assured</span><span className="hidden sm:inline">Fix Base Coverage (SA)</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isStep2Complete}
                      onClick={() => handleInputChange('inputMode', 'Premium')}
                      className={cn(
                        "py-2.5 px-3 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        input.inputMode === 'Premium' 
                          ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <DollarSign className="w-3.5 h-3.5" /> <span className="sm:hidden">Premium</span><span className="hidden sm:inline">Fix Target Premium</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {/* SDPP Plan Category Selection */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                        Select SDPP Category Plan
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {SDPP_PLANS.map(plan => (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => {
                              handleInputChange('sdppPlan', plan.id as SDPPPlan);
                              if (plan.id === 'Elite') {
                                if (!input.dailyHospitalCoverage || input.dailyHospitalCoverage < 1000) {
                                  handleInputChange('dailyHospitalCoverage', 1000);
                                }
                              } else {
                                handleInputChange('dailyHospitalCoverage', 0);
                              }
                            }}
                            className={cn(
                              "py-2.5 px-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1",
                              input.sdppPlan === plan.id
                                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                            )}
                          >
                            <span>{plan.name}</span>
                            {input.sdppPlan === plan.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 4: POLICY TERM / PREMIUM MODE */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                !isStep3Complete
                  ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                  : isStep4Complete
                  ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep4Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep4Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "4"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      {isSDPP ? "Policy Term Duration" : "Premium Payment Mode"}
                    </h4>
                  </div>
                  {!isStep3Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Select Plan First</span>}
                  {isStep4Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                {isSDPP ? (
                  <div className="relative pt-1">
                    <select
                      value={input.term}
                      disabled={!isStep3Complete}
                      onChange={(e) => handleInputChange('term', Number(e.target.value))}
                      className={cn(
                        "w-full bg-white border rounded-full px-5 py-2.5 text-xs sm:text-sm font-black text-slate-900 outline-none transition-all appearance-none cursor-pointer focus:border-brand-primary",
                        validationErrors.term ? "border-red-500" : "border-slate-200"
                      )}
                    >
                      <option value={0} disabled className="text-slate-400">-- Select Policy Term --</option>
                      {currentRules.terms.map((t: number) => (
                        <option key={t} value={t} className="text-slate-800 font-sans font-bold">
                          {t} Years
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {FREQUENCIES.map(f => {
                      const isApplicable = isSinglePremiumProduct ? f === 'Single' : f !== 'Single';
                      if (!isApplicable) return null;
                      return (
                        <button
                          key={f}
                          type="button"
                          disabled={!isStep3Complete}
                          onClick={() => handleInputChange('paymentMethod', f)}
                          className={cn(
                            "flex-1 min-w-[70px] py-2.5 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                            input.paymentMethod === f 
                              ? "bg-brand-primary border-brand-primary text-white shadow-sm" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                )}
                {isSDPP && validationErrors.term && <p className="text-[10px] text-red-500 font-bold italic px-2">{validationErrors.term}</p>}
              </div>

              {/* STEP 5: PREMIUM MODE / POLICY TERM */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                !isStep4Complete
                  ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                  : isStep5Complete
                  ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep5Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep5Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "5"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      {isSDPP ? "Premium Payment Mode" : "Policy Term Duration"}
                    </h4>
                  </div>
                  {!isStep4Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Select Term First</span>}
                  {isStep5Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                {isSDPP ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {FREQUENCIES.map(f => {
                      if (f === 'Single') return null;
                      return (
                        <button
                          key={f}
                          type="button"
                          disabled={!isStep4Complete}
                          onClick={() => handleInputChange('paymentMethod', f)}
                          className={cn(
                            "flex-1 min-w-[70px] py-2.5 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all text-center cursor-pointer",
                            input.paymentMethod === f 
                              ? "bg-brand-primary border-brand-primary text-white shadow-sm" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relative pt-1">
                    <select
                      value={input.term}
                      disabled={!isStep4Complete}
                      onChange={(e) => handleInputChange('term', Number(e.target.value))}
                      className={cn(
                        "w-full bg-white border rounded-full px-5 py-2.5 text-xs sm:text-sm font-black text-slate-900 outline-none transition-all appearance-none cursor-pointer focus:border-brand-primary",
                        validationErrors.term ? "border-red-500" : "border-slate-200"
                      )}
                    >
                      <option value={0} disabled className="text-slate-400">-- Select Policy Term --</option>
                      {currentRules.terms.map((t: number) => (
                        <option key={t} value={t} className="text-slate-800 font-sans font-bold">
                          {t} Years
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
                {!isSDPP && validationErrors.term && <p className="text-[10px] text-red-500 font-bold italic px-2">{validationErrors.term}</p>}
              </div>

              {/* STEP 6: DEPOSIT AMOUNT / BASE COVERAGE */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                !isStep5Complete
                  ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                  : isStep6Complete
                  ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                  : "bg-slate-50/90 border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                      isStep6Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                    )}>
                      {isStep6Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "6"}
                    </span>
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                      {isSDPP ? `${input.paymentMethod || 'Monthly'} Deposit Amount` : (input.inputMode === 'SumAssured' ? 'Base Coverage (SA)' : 'Target Premium Amount')}
                    </h4>
                  </div>
                  {!isStep5Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Select Mode First</span>}
                  {isStep6Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                </div>

                <div className="relative pt-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    disabled={!isStep5Complete}
                    value={input.inputMode === 'SumAssured' ? (input.sumAssured === 0 ? '' : input.sumAssured) : (input.targetPremium === 0 ? '' : input.targetPremium)}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      if (input.inputMode === 'SumAssured') handleInputChange('sumAssured', val);
                      else handleInputChange('targetPremium', val);
                    }}
                    placeholder="Enter amount (BDT)"
                    className={cn(
                      "w-full bg-white border rounded-full px-5 py-2.5 text-xs sm:text-sm font-mono font-black text-slate-900 outline-none transition-all focus:border-brand-primary",
                      (validationErrors.sumAssured || validationErrors.targetPremium) ? "border-red-500" : "border-slate-200"
                    )}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">BDT</span>
                </div>
                {(validationErrors.sumAssured || validationErrors.targetPremium) && (
                  <p className="text-[10px] text-red-500 font-bold italic px-2">
                    {validationErrors.sumAssured || validationErrors.targetPremium}
                  </p>
                )}

                {/* IF SDPP and Elite: Hospital Coverage, Critical Illness, and Interest Rate inputs inside Step 6 */}
                {isSDPP && input.sdppPlan === 'Elite' && (() => {
                  const depositFreq = input.paymentMethod || 'Monthly';
                  const yearlyMult = depositFreq === 'Yearly' ? 1 : depositFreq === 'Half-yearly' ? 2 : depositFreq === 'Quarterly' ? 4 : 12;
                  const annualDepositAmt = (input.targetPremium || 0) * yearlyMult;
                  const calculatedSumAssured = annualDepositAmt * (input.term || 0);
                  const maxDailyHospital = Math.min(25000, Math.round(calculatedSumAssured * 0.02));
                  
                  const hiPremium = sdppData?.hiModePremium || 0;
                  const ciPremium = sdppData?.ciModePremium || 0;

                  return (
                    <div className="space-y-4 pt-3 border-t border-slate-100 mt-2">
                      {/* Daily Hospital Coverage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-brand-primary" /> Daily Hospital Coverage Amount (BDT)
                          </label>
                          {hiPremium > 0 && (
                            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                              Rider Premium: +{formatCurrency(hiPremium)} / {depositFreq}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={input.dailyHospitalCoverage || ''}
                            onChange={(e) => handleInputChange('dailyHospitalCoverage', Number(e.target.value))}
                            placeholder={`Min ৳1,000 - Max ৳${maxDailyHospital > 0 ? maxDailyHospital.toLocaleString() : '25,000'}/day`}
                            className="w-full bg-white border border-slate-200 rounded-full px-4 py-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-brand-primary"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">BDT/Day</span>
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium italic">
                          Min ৳1,000 | Policy Max: ৳{maxDailyHospital > 0 ? maxDailyHospital.toLocaleString() : '25,000'}/day (2% of Sum Assured ৳{calculatedSumAssured.toLocaleString()}, max ৳25,000/day)
                        </p>
                      </div>

                      {/* Active Critical Illness (15 Diseases) for Elite Plan */}
                      <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">
                              Active Critical Illness Rider (15 Diseases)
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold block">
                              Included in Elite Plan
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded border border-amber-300 block">
                            +{formatCurrency(ciPremium)} / {depositFreq}
                          </span>
                        </div>
                      </div>

                      {/* Expected Return Rate Input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-brand-primary" /> Expected Return / Interest Rate % (Optional)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={input.customInterestRate || ''}
                            onChange={(e) => handleInputChange('customInterestRate', e.target.value === '' ? undefined : Number(e.target.value))}
                            placeholder="Optional (Default 7% - 9% Range)"
                            className="w-full bg-white border border-slate-200 rounded-full px-4 py-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-brand-primary"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              </div>
              <div className={wizardStep === 3 ? 'space-y-4' : 'hidden'}>
              {/* STEP 7: ADDITIONAL RIDERS (OPTIONAL) */}
              {!isSDPP && !isSinglePremiumProduct && (
                <div className={cn(
                  "p-4 rounded-2xl border transition-all duration-300 space-y-3",
                  !isStep6Complete
                    ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                    : "bg-slate-50/90 border-slate-200 opacity-100"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 text-[10px] font-black flex items-center justify-center">
                        7
                      </span>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                        Additional Rider Coverage (Optional)
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Optional - Can Skip</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button 
                      type="button"
                      disabled={!isStep6Complete}
                      onClick={() => handleInputChange('hasAccidentalProtection', !input.hasAccidentalProtection)}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer",
                        input.hasAccidentalProtection 
                          ? "bg-brand-primary/5 border-brand-primary shadow-sm" 
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all text-xs",
                          input.hasAccidentalProtection ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          <Zap className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">Accidental Coverage</p>
                          <p className="text-[9px] text-slate-500 font-medium">Double sum assured in case of accident</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                        input.hasAccidentalProtection ? "bg-brand-primary border-brand-primary" : "border-slate-300"
                      )}>
                        {input.hasAccidentalProtection && <Check className="w-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </button>

                    <button 
                      type="button"
                      disabled={!isStep6Complete}
                      onClick={() => {
                        const newValue = !input.hasCIClassic;
                        handleInputChange('hasCIClassic', newValue);
                        if (newValue) handleInputChange('hasCIStandard', false);
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer",
                        input.hasCIClassic 
                          ? "bg-emerald-50 border-emerald-500 shadow-sm" 
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all text-xs",
                          input.hasCIClassic ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          <Activity className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">Classic Critical Illness</p>
                          <p className="text-[9px] text-slate-500 font-medium">Protection for 19 critical diseases</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                        input.hasCIClassic ? "bg-emerald-600 border-emerald-600" : "border-slate-300"
                      )}>
                        {input.hasCIClassic && <Check className="w-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </button>

                    <button 
                      type="button"
                      disabled={!isStep6Complete}
                      onClick={() => {
                        const newValue = !input.hasCIStandard;
                        handleInputChange('hasCIStandard', newValue);
                        if (newValue) handleInputChange('hasCIClassic', false);
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer",
                        input.hasCIStandard 
                          ? "bg-amber-50 border-amber-500 shadow-sm" 
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all text-xs",
                          input.hasCIStandard ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          <Shield className="w-3 h-3" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">Standard Critical Illness</p>
                          <p className="text-[9px] text-slate-500 font-medium">Protection for 25 illnesses</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                        input.hasCIStandard ? "bg-amber-600 border-amber-600" : "border-slate-300"
                      )}>
                        {input.hasCIStandard && <Check className="w-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

              </div>
            {/* RIGHT COLUMN: SDPP COMBO SETTINGS */}
            {wizardStep === 3 && isComboEnabled && !isSDPP && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="lg:col-span-6 2xl:col-span-5 bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-xs">
                        P2
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-brand-primary tracking-widest block">Policy 2 (Combo)</span>
                        <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-wider">
                          Shanta SDPP Package
                        </h3>
                      </div>
                    </div>
                    {input.term > 0 && (
                      <span className="text-[10px] font-mono font-bold uppercase bg-white text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                        Term: {input.term} Yrs
                      </span>
                    )}
                  </div>

                  {/* COMBO STEP 1: SDPP PLAN CATEGORY */}
                  <div className={cn(
                    "p-3.5 rounded-2xl border transition-all duration-300 space-y-2.5",
                    isComboStep1Complete
                      ? "bg-emerald-50/30 border-emerald-300/80"
                      : "bg-white border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                          isComboStep1Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                        )}>
                          {isComboStep1Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "1"}
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                          SDPP Plan Category
                        </h4>
                      </div>
                      {isComboStep1Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-0.5">
                      {(['Elite', 'Signature', 'Prime'] as SDPPPlan[]).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setComboSdppPlan(p)}
                          className={cn(
                            "py-2 rounded-full border text-xs font-black uppercase transition-all cursor-pointer",
                            comboSdppPlan === p 
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* COMBO STEP 2: DEPOSIT MODE & DEPOSIT AMOUNT */}
                  <div className={cn(
                    "p-3.5 rounded-2xl border transition-all duration-300 space-y-2.5",
                    !isComboStep1Complete
                      ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                      : isComboStep2Complete
                      ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                      : "bg-white border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                          isComboStep2Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                        )}>
                          {isComboStep2Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "2"}
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                          Deposit Mode & Deposit Amount
                        </h4>
                      </div>
                      {!isComboStep1Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Select Plan Category First</span>}
                      {isComboStep2Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                    </div>

                    <div className="space-y-3 pt-0.5">
                      {/* Deposit Mode - Preselected based on Primary Plan Premium Method */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Deposit Mode</span>
                          <span className="text-[9px] text-brand-primary font-bold lowercase italic">Synced with Policy 1</span>
                        </label>
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-full px-4 py-2 text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span className="font-black text-brand-primary uppercase">{comboSdppPaymentMethod || 'Monthly'} Deposit</span>
                          <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded-full uppercase font-bold">Auto-filled</span>
                        </div>
                      </div>

                      {/* Deposit Amount - Filled by user */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {comboSdppPaymentMethod || 'Monthly'} Deposit Amount
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            disabled={!isComboStep1Complete}
                            value={comboSdppDeposit || ''}
                            onChange={(e) => setComboSdppDeposit(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                            placeholder="Enter deposit amount (BDT)"
                            className="w-full bg-white border border-slate-200 rounded-full px-4 py-2 text-xs sm:text-sm font-mono font-black text-slate-900 outline-none focus:border-brand-primary"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">BDT</span>
                        </div>
                        {validationErrors.comboSdppDeposit && (
                          <p className="text-[10px] text-red-500 font-bold italic px-2">{validationErrors.comboSdppDeposit}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COMBO STEP 3: DAILY HOSPITAL COVERAGE (ELITE ONLY) */}
                  {comboSdppPlan === 'Elite' && (
                    <div className={cn(
                      "p-3.5 rounded-2xl border transition-all duration-300 space-y-2.5",
                      !isComboStep2Complete
                        ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                        : isComboStep3Complete
                        ? "bg-emerald-50/30 border-emerald-300/80 opacity-100"
                        : "bg-white border-brand-primary/30 ring-2 ring-brand-primary/10 shadow-sm opacity-100"
                    )}>
                      {(() => {
                        const comboMultiplier = comboSdppPaymentMethod === 'Yearly' ? 1 : comboSdppPaymentMethod === 'Half-yearly' ? 2 : comboSdppPaymentMethod === 'Quarterly' ? 4 : 12;
                        const comboYearlyDeposit = comboSdppDeposit * comboMultiplier;
                        const comboSumAssured = input.term * comboYearlyDeposit;
                        const calculatedMaxCap = comboSdppDeposit > 0 ? Math.min(25000, 0.02 * comboSumAssured) : 25000;

                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                                  isComboStep3Complete ? "bg-emerald-600 text-white" : "bg-brand-primary text-white"
                                )}>
                                  {isComboStep3Complete ? <Check className="w-3 h-3 stroke-[3]" /> : "3"}
                                </span>
                                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                                  Daily Hospital Coverage (Elite Only)
                                </h4>
                              </div>
                              {!isComboStep2Complete && <span className="text-[10px] font-bold text-slate-400 uppercase">Enter Deposit First</span>}
                              {isComboStep3Complete && <span className="text-[10px] font-bold text-emerald-600 uppercase">Completed</span>}
                            </div>

                            <div className="space-y-1 pt-0.5">
                              <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hospital Daily Allowance</label>
                                <span className="text-[9px] text-brand-primary font-bold">Max ৳{calculatedMaxCap.toLocaleString()}</span>
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={1000}
                                  max={calculatedMaxCap}
                                  disabled={!isComboStep2Complete}
                                  value={comboSdppDailyHospitalCoverage || ''}
                                  onChange={(e) => setComboSdppDailyHospitalCoverage(e.target.value === '' ? 0 : Number(e.target.value))}
                                  placeholder={`Min 1k - Max ৳${calculatedMaxCap.toLocaleString()}`}
                                  className="w-full bg-white border border-slate-200 rounded-full px-4 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand-primary"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">BDT/Day</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* COMBO STEP 4: INTEREST RATE (OPTIONAL) */}
                  <div className={cn(
                    "p-3.5 rounded-2xl border transition-all duration-300 space-y-2.5",
                    !isComboStep2Complete
                      ? "bg-slate-50/40 border-slate-200/60 opacity-35 pointer-events-none cursor-not-allowed filter blur-[0.2px] select-none"
                      : "bg-white border-slate-200 opacity-100"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 text-[10px] font-black flex items-center justify-center">
                          {comboSdppPlan === 'Elite' ? "4" : "3"}
                        </span>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                          Interest Rate % (Optional)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Optional</span>
                    </div>

                    <div className="space-y-1 pt-0.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custom Return Rate</label>
                        <span className="text-[9px] text-slate-400 font-bold">Default Range: 7% - 9%</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          disabled={!isComboStep2Complete}
                          value={comboSdppCustomRate}
                          onChange={(e) => setComboSdppCustomRate(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                          placeholder="e.g. 8.5 (Default 7%-9%)"
                          className="w-full bg-white border border-slate-200 rounded-full px-4 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-brand-primary"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Validation Errors Notice */}
          {Object.keys(validationErrors).length > 0 && isStep6Complete && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 space-y-1 text-xs text-red-700">
              <div className="flex items-center gap-2 font-black text-red-600 uppercase">
                <AlertCircle className="w-4 h-4" />
                <span>Configuration Warning</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 font-semibold">
                {Object.values(validationErrors).map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            
            {/* Left Metric Display */}
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-black uppercase text-slate-600 tracking-wider">
                Total Premium ({input.paymentMethod ? input.paymentMethod.toUpperCase() : '---'}):
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-600 tracking-tight">
                {formatCurrency(totalPayableAmount)}
              </span>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-3 justify-end">
              <button 
                type="button"
                onClick={handleReset}
                className="rounded-full px-5 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-slate-800 cursor-pointer transition-all shadow-md flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>

              <button 
                onClick={() => { if (wizardStep < 3) setWizardStep((wizardStep+1) as 1|2|3); else { setPreviewSection('quotation'); setAppState('results'); } }}
                disabled={(wizardStep === 1 && !isStep1Complete) || (wizardStep === 2 && !isStep6Complete) || (wizardStep === 3 && (!isStep6Complete || !isComboFullyComplete || Object.keys(validationErrors).length > 0))}
                className={cn(
                  "rounded-full px-7 py-3 font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                  (!isStep6Complete || !isComboFullyComplete || Object.keys(validationErrors).length > 0)
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/25 active:scale-95"
                )}
              >
                {wizardStep < 3 ? 'Next' : 'View Calculation Result'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCompareMode = () => {
    return (
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-8 pb-20 px-2 md:px-0">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-4xl font-black text-brand-text uppercase tracking-tighter">Market Comparison</h2>
          <p className="text-[10px] md:text-sm text-slate-400 font-black uppercase tracking-widest italic flex items-center justify-center gap-2">
            <span>Benchmarked against your {formatCurrency(input.sumAssured)} Coverage</span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="text-brand-primary">{input.paymentMethod} Basis</span>
          </p>
        </div>

        <div className="bg-brand-dark border border-brand-primary/10 rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-brand-primary/5">
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-slate-400 text-[10px] md:text-[12px] border-b border-brand-primary/10">Insurance Plan</th>
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-slate-400 text-[10px] md:text-[12px] text-center border-b border-brand-primary/10">Without Rider</th>
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-brand-primary text-[10px] md:text-[12px] text-center border-b border-brand-primary/10">With Rider</th>
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-slate-400 text-[10px] md:text-[12px] text-center border-b border-brand-primary/10">Maturity Benefit</th>
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-slate-400 text-[10px] md:text-[12px] text-center border-b border-brand-primary/10">Natural Death</th>
                  <th className="px-4 py-6 md:px-8 font-black uppercase tracking-widest text-slate-400 text-right border-b border-brand-primary/10">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-primary/5">
                {results.filter(r => (r?.totalPremium?.[input.paymentMethod] || 0) > 0).map(plan => {
                  const isCurrent = (selectedProductId === 'sdpp' && plan.productId.startsWith('sdpp_')) 
                   ? plan.productId === `sdpp_${input.sdppPlan.toLowerCase()}`
                   : plan.productId === selectedProductId;
                  
                  const maturityActionVal = plan.productId.startsWith('sdpp_') 
                    ? (plan as any).sdppData?.maturity9 
                    : (plan.maturityValue || input.sumAssured);

                  return (
                    <tr key={plan.productId} className={cn(
                      "group transition-colors hover:bg-white/5",
                      isCurrent && "bg-brand-primary/5"
                    )}>
                      <td className="px-4 py-6 md:px-8">
                         <div className="space-y-1">
                            <p className="text-[10px] md:text-sm font-black text-brand-text leading-tight">{plan.productName}</p>
                            {isCurrent && (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-2 h-2 md:w-3 md:h-3 text-brand-primary" />
                                <span className="text-[10px] md:text-[11px] text-brand-primary font-black uppercase tracking-widest">Active Valuation</span>
                              </div>
                            )}
                         </div>
                      </td>
                      <td className="px-4 py-6 md:px-8 text-center">
                         <p className="text-[9px] md:text-sm font-black text-slate-400 font-mono">
                           {plan.productId.startsWith('sdpp_') 
                             ? formatCurrency(plan.sdppData.annualPremium / (input.paymentMethod === 'Yearly' ? 1 : input.paymentMethod === 'Half-yearly' ? 2 : input.paymentMethod === 'Quarterly' ? 4 : 12))
                             : formatCurrency(plan.basePremium?.[input.paymentMethod] || 0)}
                         </p>
                      </td>
                      <td className="px-4 py-6 md:px-8 text-center">
                         <p className="text-[10px] md:text-xl font-black text-brand-primary font-mono">{formatCurrency(plan.totalPremium?.[input.paymentMethod] || 0)}</p>
                      </td>
                      <td className="px-4 py-6 md:px-8 text-center">
                         <p className="text-[9px] md:text-sm font-black text-slate-500 font-mono italic">{formatCurrency(maturityActionVal)}</p>
                      </td>
                      <td className="px-4 py-6 md:px-8 text-center">
                         <p className="text-[9px] md:text-sm font-bold text-slate-400 font-mono">{formatCurrency(input.sumAssured)}</p>
                      </td>
                      <td className="px-4 py-6 md:px-8 text-right">
                         <button 
                           onClick={() => {
                             if (plan.productId.startsWith('sdpp_')) {
                               setSelectedProductId('sdpp');
                               setInput(prev => ({ ...prev, sdppPlan: plan.productId.split('_')[1].charAt(0).toUpperCase() + plan.productId.split('_')[1].slice(1) as any }));
                             } else {
                               setSelectedProductId(plan.productId);
                             }
                             setIsCompareMode(false);
                           }}
                           className={cn(
                             "px-3 py-2 md:px-6 md:py-3 rounded-full text-[10px] md:text-[12px] font-black uppercase tracking-widest transition-all",
                             isCurrent 
                               ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                               : "bg-brand-dark border border-brand-primary/20 text-brand-text hover:bg-brand-primary hover:text-white"
                           )}
                         >
                           {isCurrent ? 'Viewing' : 'Select'}
                         </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-brand-primary/5 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-brand-primary/10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
           <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 md:w-8 md:h-8 text-brand-primary" />
           </div>
           <div className="space-y-1">
              <h4 className="text-lg md:text-xl font-black text-brand-text uppercase tracking-tight">Smart Benchmarking Engine</h4>
              <p className="text-xs md:text-sm text-slate-400 font-medium leading-relaxed italic">All calculations are real-time and strictly validated against current actuarial guidelines. Select a plan to view its complete liquidity trajectory and localized protection riders.</p>
           </div>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const isChildPlan = selectedProductId.startsWith('scep');
    const childPercentageStr = isChildPlan ? (selectedProductId.split('_').pop() || '1') : '0';
    const childPercentage = isChildPlan ? parseInt(childPercentageStr) / 100 : 0;
    const childStipend = isChildPlan ? input.sumAssured * childPercentage : 0;
    const maturityValue = isSDPP ? sdppData?.maturity9 : (selectedProduct?.maturityValue || input.sumAssured);

    const isSDPPResult = selectedProductId === 'sdpp';

    const totalTermInstallments = (() => {
      const freq = input.paymentMethod;
      if (freq === 'Single') return 1;
      if (freq === 'Yearly') return input.term;
      if (freq === 'Half-yearly') return input.term * 2;
      if (freq === 'Quarterly') return input.term * 4;
      if (freq === 'Monthly') return input.term * 12;
      return input.term;
    })();

    const totalTermBasePremium = (selectedProduct?.basePremium?.[input.paymentMethod] || 0) * totalTermInstallments;
    const totalTermRiderPremium = (
      (selectedProduct?.adbPremium?.[input.paymentMethod] || 0) +
      (selectedProduct?.ciClassicPremium?.[input.paymentMethod] || 0) +
      (selectedProduct?.ciStandardPremium?.[input.paymentMethod] || 0)
    ) * totalTermInstallments;
    const totalTermPaidPremium = (selectedProduct?.totalPremium?.[input.paymentMethod] || 0) * totalTermInstallments;

    const renderComboValuationSummary = () => {
      if (!isComboEnabled || !sdppComboData) return null;

      const primaryMaturity = (selectedProduct?.maturityValue || input.sumAssured);
      const primaryPaid = totalTermPaidPremium;

      const sdppPaid = sdppComboData.totalPremiumPaid || 0;
      const combinedTotalPaid = primaryPaid + sdppPaid;

      const isCustomRate = sdppComboData.customMaturity !== undefined && sdppComboData.customMaturity > 0;
      const customRateVal = comboSdppCustomRate;

      const sdppMaturityText = isCustomRate 
        ? formatCurrency(sdppComboData.customMaturity!)
        : `${formatCurrency(sdppComboData.maturity7)} - ${formatCurrency(sdppComboData.maturity9)}`;

      const combinedMaturityText = isCustomRate
        ? formatCurrency(primaryMaturity + sdppComboData.customMaturity!)
        : `${formatCurrency(primaryMaturity + sdppComboData.maturity7)} - ${formatCurrency(primaryMaturity + sdppComboData.maturity9)}`;

      return (
        <div className="p-6 md:p-10 lg:p-12 bg-white text-brand-text rounded-2xl md:rounded-[2.5rem] border border-brand-primary/20 shadow-xl space-y-6 lg:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-brand-primary/10 pb-4 md:pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary flex-shrink-0">
                <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <span className="text-[10px] md:text-xs bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                  Combo Package Active
                </span>
                <h3 className="text-lg md:text-2xl lg:text-3xl font-black text-brand-text uppercase tracking-tight mt-1">
                  Accumulated Combo Valuation
                </h3>
              </div>
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest block">Policy Term</span>
              <span className="text-sm md:text-lg lg:text-xl font-black font-mono text-brand-primary">{input.term} Years</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Primary Policy Card */}
            <div className="bg-brand-dark/60 border border-brand-primary/15 p-5 lg:p-6 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Policy 1</span>
                  <span className="text-[9px] bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 rounded font-mono font-bold">Primary</span>
                </div>
                <h4 className="text-xs md:text-sm lg:text-base font-black text-slate-800 uppercase mt-2">
                  {selectedProduct?.productName || 'Primary Plan'}
                </h4>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-brand-primary/10 text-xs md:text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">Total Premium Paid:</span>
                  <strong className="font-mono text-slate-800 whitespace-nowrap">{formatCurrency(primaryPaid)}</strong>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">Maturity Benefit:</span>
                  <strong className="font-mono text-brand-primary whitespace-nowrap">{formatCurrency(primaryMaturity)}</strong>
                </div>
              </div>
            </div>

            {/* SDPP Policy Card */}
            <div className="bg-brand-dark/60 border border-brand-primary/15 p-5 lg:p-6 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-brand-primary uppercase font-black tracking-widest">Policy 2</span>
                  <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2.5 py-0.5 rounded font-mono font-bold">SDPP</span>
                </div>
                <h4 className="text-xs md:text-sm lg:text-base font-black text-brand-primary uppercase mt-2">
                  Shanta SDPP - {comboSdppPlan}
                </h4>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-brand-primary/10 text-xs md:text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">Total Deposit Paid:</span>
                  <strong className="font-mono text-slate-800 whitespace-nowrap">{formatCurrency(sdppPaid)}</strong>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 font-medium">Maturity ({isCustomRate ? `${customRateVal}%` : '7% - 9%'}):</span>
                  <strong className="font-mono text-brand-primary text-right whitespace-nowrap">{sdppMaturityText}</strong>
                </div>
              </div>
            </div>

            {/* Combined Total Card */}
            <div className="bg-brand-primary/10 border-2 border-brand-primary p-5 lg:p-6 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-brand-primary uppercase font-black tracking-widest">Accumulated Result</span>
                  <span className="text-[9px] bg-brand-primary text-white font-black px-2.5 py-0.5 rounded uppercase">
                    Total
                  </span>
                </div>
                <h4 className="text-xs md:text-sm lg:text-base font-black text-slate-900 uppercase mt-2">
                  Total Combo Benefit
                </h4>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-brand-primary/20 text-xs md:text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-700 font-bold">Total Paid ({input.term} yrs):</span>
                  <strong className="font-mono text-slate-900 whitespace-nowrap">{formatCurrency(combinedTotalPaid)}</strong>
                </div>
                <div className="bg-brand-primary/15 p-3.5 rounded-xl border border-brand-primary/30 space-y-1">
                  <span className="text-brand-primary font-black uppercase text-[10px] md:text-[11px] tracking-wider block">Accumulated Maturity:</span>
                  <strong className="font-mono text-brand-primary text-xs sm:text-sm lg:text-base font-black block tracking-tight">
                    {combinedMaturityText}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

    const renderProjectionTable = () => (
      <div className="bg-brand-dark/50 border border-brand-primary/10 rounded-2xl md:rounded-[3rem] overflow-hidden shadow-xl backdrop-blur-xl">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px]">
               <thead>
                  <tr className="bg-brand-dark sticky top-0">
                     <th className="p-3 md:p-5 font-black text-slate-500 uppercase tracking-widest text-center text-[11px]">End of Year</th>
                     <th className="p-3 md:p-5 font-black text-brand-primary uppercase tracking-widest border-l border-brand-primary/5 text-[11px]">Base Premium</th>
                     <th className="p-3 md:p-5 font-black text-slate-500 uppercase tracking-widest border-l border-brand-primary/5 text-[11px]">Natural death</th>
                     <th className="p-3 md:p-5 font-black text-brand-gold uppercase tracking-widest border-l border-brand-primary/5 text-[11px]">Surrender value</th>
                     <th className="p-3 md:p-5 font-black text-slate-500 uppercase tracking-widest border-l border-brand-primary/5 text-[11px]">Paid Up Value</th>
                     <th className="p-3 md:p-5 font-black text-slate-500 uppercase tracking-widest border-l border-brand-primary/5 text-[11px]">ETI Benefits</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-brand-primary/5">
                  {projectionData.map((row) => (
                     <tr key={row.year} className="hover:bg-brand-primary/5 transition-all group">
                        <td className="p-4 md:p-8 font-black text-slate-400 text-base md:text-lg text-center tracking-tight">{row.year}</td>
                        <td className="p-4 md:p-8 font-mono font-bold text-brand-text border-l border-brand-primary/5">
                          {row.premium > 0 ? formatCurrency(row.premium) : '—'}
                        </td>
                        <td className="p-4 md:p-8 font-bold text-slate-500 border-l border-slate-100">
                          {formatCurrency(row.deathBenefit)}
                        </td>
                        <td className="p-4 md:p-8 font-mono font-black text-brand-gold border-l border-slate-100 text-base md:text-lg tracking-tight">
                          {row.surrenderValue > 0 ? formatCurrency(row.surrenderValue) : '—'}
                        </td>
                        <td className="p-4 md:p-8 font-bold text-slate-500 border-l border-slate-100">
                          {row.paidUpValue > 0 ? formatCurrency(row.paidUpValue) : '—'}
                        </td>
                        <td className={cn(
                           "p-4 md:p-8 font-black border-l border-slate-100 font-mono italic tracking-tighter",
                           row.etiDurationStr === '—' ? "text-slate-300" : 
                           row.etiDurationStr.startsWith('-') ? "text-rose-500" : 
                           "text-emerald-500"
                        )}>
                           {row.etiDurationStr !== '—' ? (
                             <div className="flex flex-col items-center">
                               <span>{row.etiDurationStr}</span>
                               <span className="text-[7px] md:text-[9px] font-bold uppercase opacity-60 text-center">
                                 Active Death Coverage: {formatCurrency(row.etiCoverage)}
                               </span>
                             </div>
                           ) : '—'}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <div className="p-4 md:p-10 bg-slate-50 border-t border-slate-100 text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center italic">
            * Note: To determine CSV for the interim period linear interpolation should be used between the periods t and t+1.
         </div>
      </div>
    );

    const renderSDPPPremiumSummary = () => {
      if (!sdppData) return null;
      return (
        <div className="bg-slate-900 rounded-3xl p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="space-y-1">
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest leading-none">Total Premium Paid</p>
            <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter tabular-nums">
              {formatCurrency(sdppData.totalPremiumPaid)}
            </h3>
          </div>
          <div className="pt-6 border-t border-white/10 flex justify-between items-end">
            <div className="flex gap-12">
              <div className="space-y-1">
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Basic</p>
                <p className="text-lg font-black">{formatCurrency(sdppData.totalBasicPremiumPaid)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Rider</p>
                <p className="text-lg font-black">{formatCurrency(sdppData.totalRiderPremiumPaid)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1">Policy Term</p>
              <p className="text-xl md:text-2xl font-black italic">{input.term} Years</p>
            </div>
          </div>
        </div>
      );
    };

    const renderSDPPMaturityEstimate = () => {
      if (!sdppData) return null;
      return (
        <div className="bg-blue-50/50 border border-blue-100 rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/20">
              <ArrowLeftRight className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-[11px] font-black text-brand-dark uppercase tracking-widest">Maturity Summary Estimate</h4>
          </div>
          <div className="space-y-3">
             <div className="bg-brand-dark flex justify-between items-center p-5 rounded-2xl border border-brand-primary/10 shadow-sm">
               <span className="text-sm font-bold text-slate-600">Total Investment</span>
               <span className="text-lg font-black text-brand-text">BDT {sdppData.totalPremiumPaid.toLocaleString()}</span>
             </div>
             <div className="bg-brand-primary flex justify-between items-center p-5 rounded-2xl text-white shadow-xl shadow-brand-primary/20">
               <span className="text-sm font-black italic">Estimated Maturity (7%)</span>
               <span className="text-lg font-black italic">BDT {sdppData.maturity7.toLocaleString()}</span>
             </div>
             <div className="bg-blue-900 flex justify-between items-center p-5 rounded-2xl text-white shadow-xl shadow-blue-900/20">
               <span className="text-sm font-black italic">Estimated Maturity (9%)</span>
               <span className="text-lg font-black italic">BDT {sdppData.maturity9.toLocaleString()}</span>
             </div>
          </div>
        </div>
      );
    };

    const renderSDPPBenefitSummary = () => {
      if (!sdppData) return null;
      const dailyAmt = Number(input.dailyHospitalCoverage) || 0;
      const yearlyMax = sdppData.hospitalCoverage || (dailyAmt * 25);

      const primaryCiAmt = (input.hasCIClassic || input.hasCIStandard) ? Math.min(input.sumAssured * 0.5, 3000000) : 0;
      const sdppCiAmt = sdppData.ciCoverage || 0;
      const totalCiAmt = primaryCiAmt + sdppCiAmt;

      type BaseBenefitItem = {
        icon: React.ReactNode;
        label: string;
        value: string | number;
        num?: number;
        subtitle?: string;
        specialStyle?: string;
      };

      const baseBenefits: BaseBenefitItem[] = [
        { icon: <Shield className="w-4 h-4 text-brand-primary" />, label: 'SUM ASSURED', value: sdppData.sumAssured, num: typeof sdppData.sumAssured === 'number' ? sdppData.sumAssured : 1 },
        { icon: <Activity className="w-4 h-4 text-red-500" />, label: 'DEATH BENEFIT', value: sdppData.deathBenefit, num: typeof sdppData.deathBenefit === 'number' ? sdppData.deathBenefit : 1 },
        { icon: <ArrowLeftRight className="w-4 h-4 text-brand-primary" />, label: 'ACCIDENTAL BENEFIT', subtitle: '* In addition with Death Benefit', value: sdppData.accidentalBenefit, num: sdppData.accidentalBenefit },
        { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, label: 'TAX REBATE (10%)', value: sdppData.taxRebate, specialStyle: 'bg-emerald-50 border-emerald-100 text-emerald-700', num: sdppData.taxRebate },
      ];

      if (primaryCiAmt > 0 && sdppCiAmt > 0) {
        baseBenefits.push(
          { icon: <AlertCircle className="w-4 h-4 text-brand-primary" />, label: 'PRIMARY POLICY CI COVERAGE', value: primaryCiAmt, specialStyle: 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary', num: primaryCiAmt },
          { icon: <AlertCircle className="w-4 h-4 text-brand-primary" />, label: 'SDPP CI COVERAGE', value: sdppCiAmt, specialStyle: 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary', num: sdppCiAmt },
          { icon: <AlertCircle className="w-4 h-4 text-brand-primary" />, label: 'TOTAL COMBINED CI COVERAGE', subtitle: `Primary (${formatCurrency(primaryCiAmt)}) + SDPP (${formatCurrency(sdppCiAmt)})`, value: totalCiAmt, specialStyle: 'bg-brand-primary/15 border-brand-primary/30 text-brand-primary font-black', num: totalCiAmt }
        );
      } else if (sdppCiAmt > 0) {
        baseBenefits.push({ icon: <AlertCircle className="w-4 h-4 text-brand-primary" />, label: 'CI COVERAGE', value: sdppCiAmt, specialStyle: 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary', num: sdppCiAmt });
      } else if (primaryCiAmt > 0) {
        baseBenefits.push({ icon: <AlertCircle className="w-4 h-4 text-brand-primary" />, label: 'PRIMARY POLICY CI COVERAGE', value: primaryCiAmt, specialStyle: 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary', num: primaryCiAmt });
      }

      if (input.sdppPlan === 'Elite' && dailyAmt > 0) {
        baseBenefits.push({ 
          icon: <Activity className="w-4 h-4 text-brand-primary" />, 
          label: 'DAILY HOSPITAL COVERAGE (ELITE PLAN)', 
          value: `BDT ${dailyAmt.toLocaleString()} / day`, 
          subtitle: `Max Yearly Coverage (25 days): BDT ${yearlyMax.toLocaleString()}`,
          specialStyle: 'bg-brand-primary/5 border-brand-primary/10 text-brand-primary',
          num: dailyAmt
        });
      }

      const benefits = baseBenefits.filter(b => b.num === undefined || b.num > 0);

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <Activity className="w-5 h-5 text-brand-primary" />
            <h4 className="text-lg font-black text-brand-text">Benefit Summary</h4>
          </div>
          <div className="space-y-3">
             {benefits.map((b, i) => (
               <div key={i} className={cn(
                 "flex justify-between items-center p-5 rounded-2xl border transition-all",
                 b.specialStyle || "bg-slate-50/50 border-slate-100/50 hover:bg-slate-50 hover:border-slate-200"
               )}>
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-100">
                     {b.icon}
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest leading-none">{b.label}</p>
                     {b.subtitle && <p className="text-[11px] font-medium italic text-slate-400 mt-1">{b.subtitle}</p>}
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-sm font-black italic tracking-wide">
                     {typeof b.value === 'number' ? `BDT ${b.value.toLocaleString()}` : b.value}
                   </p>
                 </div>
               </div>
             ))}
          </div>
        </div>
      );
    };

    const renderSDPPRiderPremiums = () => {
      if (!sdppData) return null;
      return (
        <div className="bg-brand-gold/5 border border-brand-gold/10 rounded-[2rem] p-10 space-y-8">
          <div className="space-y-4">
            <h4 className="text-[10px] text-brand-gold font-black uppercase tracking-[0.2em] px-1">Rider Premiums ({input.paymentMethod.toUpperCase()})</h4>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-brand-dark p-5 rounded-2xl border border-brand-gold/20 shadow-sm">
                  <p className="text-[11px] text-brand-gold/50 font-black uppercase tracking-widest mb-1">Critical Illness</p>
                  <p className="text-lg font-black text-brand-text">BDT {Math.ceil(sdppData.ciModePremium).toLocaleString()}</p>
               </div>
               <div className="bg-brand-dark p-5 rounded-2xl border border-brand-gold/20 shadow-sm">
                  <p className="text-[11px] text-brand-gold/50 font-black uppercase tracking-widest mb-1">Health Protection</p>
                  <p className="text-lg font-black text-brand-text">BDT {Math.ceil(sdppData.hiModePremium).toLocaleString()}</p>
               </div>
            </div>
          </div>
          <div className="bg-brand-primary rounded-[1.2rem] p-4 md:p-6 text-white shadow-xl shadow-brand-primary/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-all" />
             <div className="flex justify-between items-center relative z-10">
                <div>
                   <p className="text-[9px] md:text-[10px] text-white/60 font-black uppercase tracking-widest leading-none mb-1">Total {input.paymentMethod} Payable</p>
                   <p className="text-[10px] md:text-[11px] text-white/40 font-medium italic">({input.paymentMethod} Premium + Riders)</p>
                </div>
                <p className="text-xl md:text-2xl font-black italic">BDT {Math.ceil(selectedProduct?.totalPremium?.[input.paymentMethod] || 0).toLocaleString()}</p>
             </div>
          </div>
        </div>
      );
    };

    const renderComboResultView = () => {
      if (!isComboEnabled || !sdppComboData) return null;

      const primaryModePremium = selectedProduct?.totalPremium?.[input.paymentMethod] || 0;
      const sdppModePremium = sdppComboData.totalModePremium || 0;
      const combinedModePremium = primaryModePremium + sdppModePremium;

      const primaryPaid = totalTermPaidPremium;
      const sdppPaid = sdppComboData.totalPremiumPaid || 0;

      const primaryMaturity = selectedProduct?.maturityValue || input.sumAssured;
      const isCustomRate = sdppComboData.customMaturity !== undefined && sdppComboData.customMaturity > 0;
      const customRateVal = comboSdppCustomRate;

      const sdppMaturityValText = isCustomRate 
        ? formatCurrency(sdppComboData.customMaturity!)
        : `${formatCurrency(sdppComboData.maturity7)} - ${formatCurrency(sdppComboData.maturity9)}`;

      const combinedMaturityValText = isCustomRate
        ? formatCurrency(primaryMaturity + sdppComboData.customMaturity!)
        : `${formatCurrency(primaryMaturity + sdppComboData.maturity7)} - ${formatCurrency(primaryMaturity + sdppComboData.maturity9)}`;

      const p1AdbBenefit = input.hasAccidentalProtection ? input.sumAssured : 0;
      const sdppDeathBenefitNum = typeof sdppComboData.deathBenefit === 'number' ? sdppComboData.deathBenefit : 0;
      const combinedDeathBenefit = (input.sumAssured || 0) + sdppDeathBenefitNum;
      const combinedAdbBenefit = p1AdbBenefit + (sdppComboData.accidentalBenefit || 0);
      const totalTaxRebate = taxRebate + (sdppComboData.taxRebate || 0);
      const ciCoverageAmt = sdppComboData.ciCoverage || 0;
      const dailyHospitalCoverageAmt = comboSdppDailyHospitalCoverage || 0;
      const yearlyHospitalCoverageAmt = sdppComboData.hospitalCoverage || (dailyHospitalCoverageAmt * 25);

      const primaryCiAmt = (input.hasCIClassic || input.hasCIStandard) ? Math.min(input.sumAssured * 0.5, 3000000) : 0;
      const sdppCiAmt = sdppComboData.ciCoverage || 0;
      const totalCiAmt = primaryCiAmt + sdppCiAmt;

      const isChildPlan = selectedProductId.startsWith('scep');
      const stipendPercentStr = selectedProductId.split('_').pop() || '1';
      const stipendPercentNum = parseInt(stipendPercentStr) || 1;
      const childStipend = input.sumAssured * (stipendPercentNum / 100);

      const allCombinedBenefits: Array<{
        label: string;
        displayValue: string;
        numericValue: number;
        subtitle: string;
        icon: React.ReactNode;
        highlight?: boolean;
        breakdownSections?: Array<{
          title: string;
          badge?: string;
          items: Array<{ label: string; value: string }>;
        }>;
      }> = [
        { 
          label: `ACCUMULATED MATURITY BENEFIT ${isCustomRate ? `(${customRateVal}%)` : '(7% - 9%)'}`, 
          displayValue: combinedMaturityValText,
          numericValue: 1, // Always show maturity
          subtitle: `Policy 1 (${formatCurrency(primaryMaturity)}) + SDPP (${sdppMaturityValText})`,
          icon: <Sparkles className="w-5 h-5 text-brand-gold" />,
          highlight: true
        }
      ];

      // Death benefits breakdown logic
      if (isChildPlan) {
        const sdppDeathVal = typeof sdppComboData.deathBenefit === 'number' ? sdppComboData.deathBenefit : 0;
        const totalChildDeathCoverage = input.sumAssured + sdppDeathVal;

        allCombinedBenefits.push({ 
          label: 'TOTAL COMBINED LIFE COVERAGE (DEATH BENEFIT)', 
          displayValue: formatCurrency(totalChildDeathCoverage),
          numericValue: totalChildDeathCoverage,
          subtitle: `Policy 1 Child SA (${formatCurrency(input.sumAssured)}) + Policy 2 SDPP Cover (${formatCurrency(sdppDeathVal)}) + Monthly Stipend`,
          icon: <Shield className="w-5 h-5 text-brand-primary" />,
          highlight: true,
          breakdownSections: [
            {
              title: 'Child Education Plan & SDPP Death Benefits Breakdown',
              items: [
                { label: 'Policy 1 (Child Plan Sum Assured at Maturity)', value: formatCurrency(primaryMaturity) },
                { label: 'Policy 1 (Monthly Education Stipend)', value: `${formatCurrency(childStipend)} / Month` },
                { label: `Policy 2 (Shanta SDPP ${comboSdppPlan} Life Cover)`, value: formatCurrency(sdppDeathVal) },
                { label: 'Total Cumulative Death Benefit (Policy 1 SA + Policy 2 SDPP SA)', value: formatCurrency(totalChildDeathCoverage) }
              ]
            }
          ]
        });
      } else {
        const sdppDeathVal = typeof sdppComboData.deathBenefit === 'number' ? sdppComboData.deathBenefit : 0;
        allCombinedBenefits.push({ 
          label: 'TOTAL COMBINED LIFE COVERAGE (DEATH BENEFIT)', 
          displayValue: formatCurrency(combinedDeathBenefit),
          numericValue: combinedDeathBenefit,
          subtitle: `Policy 1 Primary SA (${formatCurrency(input.sumAssured)}) + Policy 2 SDPP Cover (${formatCurrency(sdppDeathVal)})`,
          icon: <Shield className="w-5 h-5 text-brand-primary" />,
          highlight: true,
          breakdownSections: [
            {
              title: 'Life Coverage / Death Benefit Breakdown',
              items: [
                { label: 'Policy 1 (Primary Policy Sum Assured)', value: formatCurrency(input.sumAssured) },
                { label: `Policy 2 (Shanta SDPP ${comboSdppPlan} Life Cover)`, value: formatCurrency(sdppDeathVal) },
                { label: 'Total Cumulative Death Benefit', value: formatCurrency(combinedDeathBenefit) }
              ]
            }
          ]
        });
      }

      // Accidental benefits breakdown logic
      const comboMultiplierVal = comboSdppPaymentMethod === 'Yearly' ? 1 : comboSdppPaymentMethod === 'Half-yearly' ? 2 : comboSdppPaymentMethod === 'Quarterly' ? 4 : 12;
      const comboSdppTotalPaidVal = (comboSdppDeposit || 0) * comboMultiplierVal * input.term;
      const comboSdppSaVal = typeof sdppComboData?.sumAssured === 'number' && sdppComboData.sumAssured > 0 
        ? sdppComboData.sumAssured 
        : ((comboSdppDeposit || 0) * comboMultiplierVal * input.term);

      const isPrimeComboPlan = (comboSdppPlan || '').toLowerCase().includes('prime');
      
      const policy1AccidentalVal = input.hasAccidentalProtection ? input.sumAssured * 2 : input.sumAssured;
      const sdppAccidentalDeathVal = isPrimeComboPlan ? (2 * comboSdppSaVal + comboSdppTotalPaidVal) : (3 * comboSdppSaVal);
      const sdppAccidentalDeathDisplay = isPrimeComboPlan ? `${formatCurrency(2 * comboSdppSaVal)} + Paid Premium or Account Value` : formatCurrency(3 * comboSdppSaVal);
      const sdppAptdVal = 2 * comboSdppSaVal;

      const totalAccDeath = policy1AccidentalVal + sdppAccidentalDeathVal;

      const accBreakdownSections: Array<{
        title: string;
        badge?: string;
        items: Array<{ label: string; value: string }>;
      }> = [];

      accBreakdownSections.push({
        title: 'Policy 1: Primary Policy Coverage',
        badge: input.hasAccidentalProtection ? '2x SA Accidental' : '1x SA Natural Death',
        items: input.hasAccidentalProtection ? [
          { label: 'Accidental Death Benefit (2x SA)', value: formatCurrency(input.sumAssured * 2) },
          { label: 'Permanent Total Disability (PTD - 100% SA)', value: formatCurrency(input.sumAssured) },
          { label: 'Accidental Permanent Partial Disability (PPD - 100% SA)', value: formatCurrency(input.sumAssured) },
          { label: 'Accidental Medical Reimbursement (AMR - 15% SA)', value: formatCurrency(input.sumAssured * 0.15) }
        ] : [
          { label: 'Policy 1 Natural Death Coverage', value: formatCurrency(input.sumAssured) },
          { label: 'Accidental Rider Status', value: 'Not Opted (Natural Death Cover applies)' }
        ]
      });

      accBreakdownSections.push({
        title: 'Policy 2: Shanta SDPP Accidental Protection',
        badge: `${comboSdppPlan} Plan`,
        items: [
          { label: 'SDPP Accidental Death Coverage', value: sdppAccidentalDeathDisplay },
          { label: 'SDPP Permanent Total Disability (APTD - 2x SDPP SA)', value: formatCurrency(sdppAptdVal) }
        ]
      });

      accBreakdownSections.push({
        title: 'Total Cumulative Accidental Coverage Summary',
        badge: 'Cumulative Total',
        items: [
          { label: 'Policy 1 Coverage', value: formatCurrency(policy1AccidentalVal) },
          { label: 'Policy 2 SDPP Accidental Death Coverage', value: sdppAccidentalDeathDisplay },
          { label: 'Cumulative Accidental Death Coverage', value: formatCurrency(totalAccDeath) }
        ]
      });

      allCombinedBenefits.push({
        label: 'COMBINED ACCIDENTAL COVERAGE (POLICY 1 & POLICY 2)',
        displayValue: formatCurrency(totalAccDeath),
        numericValue: totalAccDeath || 1,
        subtitle: 'Policy 1 Coverage + Policy 2 SDPP Accidental Death Coverage',
        icon: <ArrowLeftRight className="w-5 h-5 text-brand-primary" />,
        highlight: true,
        breakdownSections: accBreakdownSections
      });

      // Tax Rebate
      allCombinedBenefits.push({ 
        label: 'ESTIMATED TOTAL TAX REBATE (10%)', 
        displayValue: formatCurrency(totalTaxRebate),
        numericValue: totalTaxRebate,
        subtitle: `Primary Rebate (${formatCurrency(taxRebate)}) + SDPP Rebate (${formatCurrency(sdppComboData.taxRebate)})`,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      });

      // Critical Illness breakdown logic
      if (primaryCiAmt > 0 || sdppCiAmt > 0) {
        const ciItems: Array<{ label: string; value: string }> = [];
        if (primaryCiAmt > 0) {
          ciItems.push({ label: 'Policy 1 (Primary Rider - 50% SA, Max 30L)', value: formatCurrency(primaryCiAmt) });
        }
        if (sdppCiAmt > 0) {
          ciItems.push({ label: `Policy 2 (Shanta SDPP - ${comboSdppPlan} Plan)`, value: formatCurrency(sdppCiAmt) });
        }
        ciItems.push({ label: 'Total Cumulative Critical Illness Coverage', value: formatCurrency(totalCiAmt) });

        allCombinedBenefits.push({ 
          label: 'TOTAL COMBINED CRITICAL ILLNESS COVERAGE', 
          displayValue: formatCurrency(totalCiAmt),
          numericValue: totalCiAmt,
          subtitle: `Policy 1 (${formatCurrency(primaryCiAmt)}) + Policy 2 SDPP (${formatCurrency(sdppCiAmt)})`,
          icon: <AlertCircle className="w-5 h-5 text-brand-primary" />,
          highlight: true,
          breakdownSections: [
            {
              title: 'Critical Illness Coverage Breakdown',
              items: ciItems
            }
          ]
        });
      }

      // Daily Hospital Coverage - ONLY for SDPP Elite plan!
      if (comboSdppPlan === 'Elite' && dailyHospitalCoverageAmt > 0) {
        allCombinedBenefits.push({ 
          label: 'DAILY HOSPITAL COVERAGE (SDPP ELITE PLAN)', 
          displayValue: `${formatCurrency(dailyHospitalCoverageAmt)} / day`,
          numericValue: dailyHospitalCoverageAmt,
          subtitle: `Max Yearly Coverage (up to 25 days): ${formatCurrency(yearlyHospitalCoverageAmt)}`,
          icon: <Activity className="w-5 h-5 text-brand-primary" />
        });
      }

      // Filter out any benefit where numericValue is 0
      const visibleBenefits = allCombinedBenefits.filter(b => b.numericValue > 0);

      return (
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6 md:space-y-10 pb-10 md:pb-20">
          {/* 1. Combined Total Premium Card (ABOVE Combo Valuation) */}
          <div className="bg-brand-primary text-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 lg:p-12 shadow-2xl space-y-6 lg:space-y-8 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 md:pb-6">
              <div>
                <span className="text-[10px] md:text-xs bg-white/20 text-white px-3 py-1 rounded-full font-black uppercase tracking-wider">
                  COMBINED PREMIUM / DEPOSIT
                </span>
                <h2 className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight mt-2">
                  Total Payable Premium ({input.paymentMethod})
                </h2>
              </div>
              <div className="text-left md:text-right flex-shrink-0">
                <span className="text-[10px] md:text-xs text-white/60 font-bold uppercase tracking-widest block">Policy Term</span>
                <span className="text-lg md:text-2xl lg:text-3xl font-black font-mono text-yellow-300">{input.term} Years</span>
              </div>
            </div>

            {/* Total Combined Premium Value */}
            <div className="text-center py-2 space-y-2">
              <p className="text-xs md:text-sm lg:text-base font-black text-white/70 uppercase tracking-widest">
                Combined Total ({input.paymentMethod})
              </p>
              <h3 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter font-mono text-white">
                {formatCurrency(combinedModePremium)}
              </h3>
            </div>

            {/* Premium Breakdown per Policy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <div className="bg-white/10 backdrop-blur-md p-4 md:p-6 rounded-2xl flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs lg:text-sm font-black uppercase text-white/80 truncate">Policy 1: {selectedProduct?.productName}</p>
                  <p className="text-[9px] md:text-[10px] text-white/60">{input.paymentMethod} Premium</p>
                </div>
                <strong className="text-base md:text-lg lg:text-xl font-mono font-black whitespace-nowrap flex-shrink-0">{formatCurrency(primaryModePremium)}</strong>
              </div>

              <div className="bg-white/10 backdrop-blur-md p-4 md:p-6 rounded-2xl flex items-center justify-between gap-4 border border-yellow-300/30">
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs lg:text-sm font-black uppercase text-yellow-300 truncate">Policy 2: Shanta SDPP - {comboSdppPlan}</p>
                  <p className="text-[9px] md:text-[10px] text-white/60">{comboSdppPaymentMethod} Deposit</p>
                </div>
                <strong className="text-base md:text-lg lg:text-xl font-mono font-black text-yellow-300 whitespace-nowrap flex-shrink-0">{formatCurrency(sdppModePremium)}</strong>
              </div>
            </div>
          </div>

          {/* 2. Accumulated Combo Valuation Summary */}
          {renderComboValuationSummary()}

          {/* 3. Combined Accumulated Benefits */}
          <div className="bg-white border border-brand-primary/10 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 lg:p-12 space-y-6 lg:space-y-8 shadow-xl">
            <div className="flex items-center gap-3 border-b border-brand-primary/10 pb-4 md:pb-6">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black flex-shrink-0">
                <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="text-base md:text-xl lg:text-2xl font-black text-brand-text uppercase tracking-tight">
                  Accumulated Combo Benefits
                </h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  Combined coverage and benefits across both Policy 1 and SDPP Package
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {visibleBenefits.map((b, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "p-5 lg:p-6 rounded-2xl border transition-all space-y-4",
                    b.highlight 
                      ? "bg-brand-primary/10 text-brand-text border-2 border-brand-primary/40 shadow-md col-span-1 lg:col-span-2" 
                      : "bg-white border-brand-primary/15 text-brand-text shadow-sm hover:border-brand-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-4 md:gap-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                        b.highlight ? "bg-brand-primary/20 text-brand-primary" : "bg-brand-dark/80 shadow-sm border border-brand-primary/15"
                      )}>
                        {b.icon}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-[10px] md:text-xs font-black uppercase tracking-wider",
                          b.highlight ? "text-brand-primary" : "text-slate-500"
                        )}>
                          {b.label}
                        </p>
                        <p className={cn("text-[10px] md:text-xs mt-0.5 truncate", b.highlight ? "text-slate-600 font-medium" : "text-slate-500")}>
                          {b.subtitle}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-base md:text-xl lg:text-2xl font-black font-mono whitespace-nowrap",
                        b.highlight ? "text-brand-primary" : "text-slate-900"
                      )}>
                        {b.displayValue}
                      </p>
                    </div>
                  </div>

                  {b.breakdownSections && b.breakdownSections.length > 0 && (
                    <div className="pt-3 border-t border-brand-primary/20 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {b.breakdownSections.map((sec, sIdx) => (
                        <div key={sIdx} className="bg-white border border-brand-primary/20 rounded-xl p-3.5 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between border-b border-brand-primary/10 pb-1.5">
                            <span className="text-[10px] md:text-xs font-black uppercase text-brand-primary tracking-wider">{sec.title}</span>
                            {sec.badge && (
                              <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-2 py-0.5 rounded font-mono font-bold">{sec.badge}</span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {sec.items.map((item, iIdx) => (
                              <div key={iIdx} className="flex justify-between items-center gap-2 text-xs">
                                <span className="text-slate-600 text-[10px] md:text-[11px] font-medium">{item.label}:</span>
                                <strong className="font-mono text-slate-900 text-[10px] md:text-[11px] whitespace-nowrap">{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    };

    if (isComboEnabled && sdppComboData) {
      return renderComboResultView();
    }

    if (isSDPPResult) {
      const sdppPlanName = `SDPP ${input.sdppPlan || 'Standard'}`;
      const depositFrequency = input.paymentMethod || 'Monthly';
      const yearlyMultiplier = depositFrequency === 'Yearly' ? 1 : depositFrequency === 'Half-yearly' ? 2 : depositFrequency === 'Quarterly' ? 4 : 12;
      
      const singleDeposit = input.targetPremium || 0;
      const hiPremium = sdppData?.hiModePremium || 0;
      const ciPremium = sdppData?.ciModePremium || 0;
      const totalModePremium = sdppData?.totalModePremium || (singleDeposit + hiPremium + ciPremium);

      const totalTermPayable = totalModePremium * yearlyMultiplier * input.term;
      const projectedMaturity = sdppData?.customMaturity || sdppData?.maturity7 || maturityValue || 0;
      const annualDeposit = singleDeposit * yearlyMultiplier;
      const taxRebateAmt = Math.round(annualDeposit * 0.10);
      const dailyHospitalVal = input.dailyHospitalCoverage || 1000;
      const maxYearlyHospitalVal = dailyHospitalVal * 25;

      return (
        <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6 md:space-y-10 pb-10 md:pb-20 px-2 md:px-0">
          {/* Title Header */}
          <div className="text-center py-2 space-y-1">
            <h3 className="text-xl md:text-3xl font-black text-brand-text uppercase tracking-tight">
              SHANTA {sdppPlanName.toUpperCase()} PLAN
            </h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                {input.term} Years Term Duration | {depositFrequency} Deposit Mode
              </p>
              <button
                onClick={() => setShowTermComparisonModal(true)}
                className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 px-2.5 py-1 rounded-full border border-brand-primary/20 transition-all cursor-pointer"
              >
                <BarChart3 className="w-3 h-3" />
                <span>Compare Terms Chart</span>
              </button>
            </div>
          </div>

          {/* 1. First Card: TOTAL PREMIUM & PREMIUM BREAKDOWN */}
          <div className="bg-brand-primary text-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-6 gap-4">
              <div>
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-white/80 block">
                  TOTAL PREMIUM ({depositFrequency.toUpperCase()})
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-white font-mono tracking-tight mt-1">
                  {formatCurrency(totalModePremium)}
                </h2>
              </div>
              <div className="md:text-right bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/70 block">
                  Total Term Payable Amount ({input.term} Years)
                </span>
                <span className="text-xl md:text-2xl font-black text-yellow-300 font-mono">
                  {formatCurrency(totalTermPayable)}
                </span>
              </div>
            </div>

            {/* Premium Breakdown */}
            <div className="space-y-3">
              <h5 className="text-[11px] font-black uppercase text-white/70 tracking-wider">Premium Breakdown</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                  <span className="text-[10px] text-white/70 font-bold uppercase block">Deposit Premium</span>
                  <span className="text-lg font-black font-mono text-white">{formatCurrency(singleDeposit)}</span>
                </div>
                {input.sdppPlan === 'Elite' && (
                  <>
                    <div className="bg-blue-400/20 backdrop-blur-md p-4 rounded-xl border border-blue-300/30">
                      <span className="text-[10px] text-blue-200 font-bold uppercase block">Hospital Coverage Premium</span>
                      <span className="text-lg font-black font-mono text-blue-100">+{formatCurrency(hiPremium)}</span>
                    </div>
                    <div className="bg-amber-400/20 backdrop-blur-md p-4 rounded-xl border border-amber-300/30">
                      <span className="text-[10px] text-amber-200 font-bold uppercase block">Critical Illness Premium</span>
                      <span className="text-lg font-black font-mono text-amber-100">+{formatCurrency(ciPremium)}</span>
                    </div>
                  </>
                )}
                <div className="bg-yellow-400/20 backdrop-blur-md p-4 rounded-xl border border-yellow-300/40">
                  <span className="text-[10px] text-yellow-300 font-bold uppercase block">Total Premium</span>
                  <span className="text-lg font-black font-mono text-yellow-300">{formatCurrency(totalModePremium)} / {depositFrequency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Second Card: Estimated Maturity Value */}
          <div className="bg-white border-2 border-brand-primary/30 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-brand-primary block">
                ESTIMATED MATURITY BENEFIT
              </span>
              <p className="text-xs text-slate-500 font-bold">
                {input.customInterestRate && Number(input.customInterestRate) > 0
                  ? `Projected maturity return at ${input.term} years (${input.customInterestRate}% Custom Rate)`
                  : `Projected maturity return at ${input.term} years (7% to 9% Return)`}
              </p>
            </div>
            <div className="text-center md:text-right">
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-brand-primary font-mono tracking-tight">
                {input.customInterestRate && Number(input.customInterestRate) > 0
                  ? formatCurrency(sdppData?.customMaturity || 0)
                  : `${formatCurrency(sdppData?.maturity7 || 0)} - ${formatCurrency(sdppData?.maturity9 || 0)}`}
              </h2>
            </div>
          </div>

          {/* 3. Third Section: Comprehensive Benefit Summary */}
          <div className="bg-white border border-brand-primary/15 rounded-2xl md:rounded-[2.5rem] p-6 md:p-10 space-y-6 shadow-xl">
            <div className="border-b border-brand-primary/10 pb-4">
              <h4 className="text-sm md:text-lg font-black uppercase tracking-wider text-brand-text">
                BENEFIT SUMMARY
              </h4>
              <p className="text-xs text-slate-500 font-medium">Included protections & living privileges under SDPP {input.sdppPlan}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Life / Natural Death Coverage */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Life Protection & Death Cover</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {input.sdppPlan === 'Prime' ? (
                    'Account Value or Paid Basic Deposit'
                  ) : (
                    `${formatCurrency(typeof sdppData?.deathBenefit === 'number' ? sdppData.deathBenefit : (annualDeposit * input.term))} or Account Value`
                  )}
                </span>
                <span className="text-[11px] text-slate-500 block font-medium">
                  {input.sdppPlan === 'Prime' 
                    ? 'Whichever is higher at time of death' 
                    : `Guaranteed Sum Assured (${formatCurrency(typeof sdppData?.deathBenefit === 'number' ? sdppData.deathBenefit : (annualDeposit * input.term))}) or Accumulated Account Value at death (Whichever is higher)`}
                </span>
              </div>

              {/* Accidental Protection */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-black text-brand-primary uppercase tracking-widest block">Accidental Coverage</span>
                
                {/* 1. Accidental Death Benefit */}
                <div className="space-y-0.5 border-b border-slate-200/60 pb-2.5">
                  <div className="text-xs font-bold text-slate-700">Accidental Death Benefit</div>
                  <div className="text-xl font-black text-brand-primary font-mono">
                    {input.sdppPlan === 'Prime' ? (
                      `${formatCurrency(sdppData?.accidentalBenefit || 0)} + Death Benefit`
                    ) : (
                      formatCurrency((sdppData?.accidentalBenefit || 0) + (typeof sdppData?.deathBenefit === 'number' ? sdppData.deathBenefit : 0))
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 block font-medium">
                    {input.sdppPlan === 'Prime'
                      ? 'Accidental Cover + Natural Death Benefit'
                      : 'Double Sum Assured + Main Life Cover'}
                  </span>
                </div>

                {/* 2. Accidental Permanent Total Disability */}
                <div className="space-y-0.5 pt-0.5">
                  <div className="text-xs font-bold text-slate-700">Accidental Permanent Total Disability (APTD)</div>
                  <div className="text-xl font-black text-brand-primary font-mono">
                    {formatCurrency(sdppData?.accidentalBenefit || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 block font-medium">
                    200% of Sum Assured (2x Sum Assured)
                  </span>
                </div>
              </div>

              {/* Critical Illness Coverage (if any) */}
              {(sdppData?.ciCoverage || 0) > 0 && (
                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest block">Critical Illness Protection (15 Diseases)</span>
                  <span className="text-xl font-black text-amber-600 font-mono">
                    {formatCurrency(sdppData?.ciCoverage || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-medium">SDPP {input.sdppPlan} Plan 15 Diseases CI Rider Benefit</span>
                </div>
              )}

              {/* Hospitalization Benefit (Yearly Hospital Coverage max 25 days) */}
              {(input.sdppPlan === 'Elite' || (sdppData?.hospitalCoverage || 0) > 0) && (
                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest block">Yearly Hospital Coverage</span>
                  <span className="text-xl font-black text-blue-600 font-mono">
                    {formatCurrency(dailyHospitalVal)} / Day <span className="text-xs text-slate-500 font-normal">(Up to {formatCurrency(maxYearlyHospitalVal)} / Year)</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block font-medium">Hospital stay reimbursement (Max 25 days per policy year)</span>
                </div>
              )}

              {/* Living Benefit - Tax Rebate Benefit */}
              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-300 space-y-1 md:col-span-2">
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest block">Living Benefit - Tax Rebate</span>
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {formatCurrency(taxRebateAmt)}
                </span>
                <span className="text-[11px] text-emerald-600 block font-medium">Estimated 10% Annual Income Tax Rebate Savings</span>
              </div>

              {/* Living Benefit - Partner Hospital Discount (Up to 40%) */}
              <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-300 space-y-1 md:col-span-2">
                <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest block">Living Benefit - Healthcare Privileges</span>
                <span className="text-2xl font-black text-blue-700 font-mono">
                  Up to 40%
                </span>
                <span className="text-[11px] text-blue-600 block font-medium">Partner Hospital & Healthcare Diagnostic Center Discount</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-4 md:space-y-12 pb-10 md:pb-20">
        <div className="flex items-center justify-end pb-2 md:pb-0 lg:hidden px-2">
          <div className="px-3 py-1 md:px-4 md:py-2 bg-brand-primary text-[10px] md:text-[11px] font-black text-white uppercase tracking-[0.2em] rounded-full shadow-lg shadow-brand-primary/20">
             Live Valuation
          </div>
        </div>

        {/* Hero Header */}
        <div className="text-center py-1 md:py-2">
           <h3 className="text-lg md:text-3xl font-black text-brand-text uppercase tracking-tight leading-tight px-4">{selectedProduct?.productName}</h3>
        </div>

        {/* Selected Mode Premium - Hero Section */}
        <div className="px-0 md:px-0">
           <div className={cn(
             "rounded-none md:rounded-[2rem] p-4 md:p-8 text-center space-y-2 md:space-y-6 shadow-none md:shadow-2xl relative overflow-hidden group transition-colors bg-brand-primary"
           )}>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[7.5px] md:text-base font-black text-white/70 uppercase tracking-[0.2em] md:tracking-[0.4em]">{input.paymentMethod.toUpperCase()} PREMIUM</p>
              <h3 className="text-3xl md:text-6xl font-black text-white tracking-tighter flex items-center justify-center font-mono">
                {formatCurrency(selectedProduct?.totalPremium?.[input.paymentMethod] || 0)}
              </h3>
              <div className="pt-4 md:pt-10 border-t border-white/10 grid grid-cols-3 gap-1 md:gap-8">
                  <div className="space-y-0.5 group/edit relative">
                    <p className="text-[5.5px] md:text-xs text-white/50 font-black uppercase tracking-widest leading-none">Policy Term</p>
                    {isEditingTerm ? (
                      <select
                        autoFocus
                        value={input.term}
                        onBlur={() => setIsEditingTerm(false)}
                        onChange={(e) => {
                          handleInputChange('term', Number(e.target.value));
                          setIsEditingTerm(false);
                        }}
                        className="bg-white/10 text-white rounded px-1 py-0.5 text-[9px] md:text-xl font-black outline-none border-none cursor-pointer focus:bg-white/20 w-fit mx-auto"
                      >
                        {currentRules.terms.map((t: number) => <option key={t} value={t} className="text-brand-text">{t} Years</option>)}
                      </select>
                    ) : (
                      <div 
                        onClick={() => setIsEditingTerm(true)}
                        className="flex items-center justify-center gap-1 cursor-pointer hover:text-white/80 transition-colors group/edit"
                      >
                        <p className="text-[9px] md:text-xl font-black text-white">{input.term} Years</p>
                        <Settings2 className="w-2 h-2 md:w-3 md:h-3 text-white/40 group-hover/edit:text-white transition-colors" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 group/edit relative">
                    <p className="text-[5.5px] md:text-xs text-white/50 font-black uppercase tracking-widest leading-none">Maturity Benefit</p>
                    {isEditingSA ? (
                      <div className="flex items-center justify-center">
                        <input
                          autoFocus
                          type="number"
                          value={input.sumAssured}
                          onBlur={() => setIsEditingSA(false)}
                          onKeyDown={(e) => e.key === 'Enter' && setIsEditingSA(false)}
                          onChange={(e) => handleInputChange('sumAssured', Number(e.target.value))}
                          className="bg-white/10 text-white rounded px-1 py-0.5 text-[9px] md:text-xl font-black outline-none border-none w-20 md:w-32 text-center focus:bg-white/20"
                        />
                      </div>
                    ) : (
                      <div 
                        onClick={() => setIsEditingSA(true)}
                        className="flex items-center justify-center gap-1 cursor-pointer hover:text-white/80 transition-colors group/edit"
                      >
                        <p className="text-[9px] md:text-xl font-black text-white">{formatCurrency(maturityValue || 0)}</p>
                        <Settings2 className="w-2 h-2 md:w-3 md:h-3 text-white/40 group-hover/edit:text-white transition-colors" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[5.5px] md:text-xs text-white/50 font-black uppercase tracking-widest leading-none">Annual Premium</p>
                     <p className="text-[9px] md:text-xl font-black text-white">{formatCurrency(selectedProduct?.totalPremium?.['Yearly'] || 0)}</p>
                  </div>
              </div>
           </div>
        </div>

        {/* Other Premium Modes Grid */}
        <div className="space-y-4 px-2">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
             <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest text-center sm:text-left">Benefit compare across frequencies</p>
             <button
               onClick={() => setShowTermComparisonModal(true)}
               className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
             >
               <BarChart3 className="w-3 h-3" />
               <span>Compare All Policy Terms ({currentRules.terms?.length || 'All'} Options)</span>
             </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
               {['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'].filter(f => f !== input.paymentMethod).map(f => {
                const freq = f as PlanFrequency;
                const amt = selectedProduct?.totalPremium?.[freq] || 0;
                if (amt === 0) return null;
                return (
              <div key={f} className="bg-brand-dark/60 backdrop-blur-sm border border-brand-primary/10 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between md:flex-col md:justify-center md:space-y-1 group hover:bg-brand-dark/80 hover:shadow-xl transition-all">
                <p className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest group-hover:text-brand-primary">{f}</p>
                <p className="text-base md:text-xl font-black text-brand-text font-mono tracking-tight">{formatCurrency(amt)}</p>
              </div>
                );
              })}
           </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6 md:space-y-12 px-2 md:px-0">
           {/* Section 1: Premium Breakdown & Maturity Summary (Full Width) */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
              <div className="bg-brand-dark/70 backdrop-blur-md border border-brand-primary/10 rounded-2xl md:rounded-[2.5rem] p-4 md:p-10 space-y-4 md:space-y-6 shadow-sm">
                <h4 className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] border-b border-brand-primary/10 pb-2 md:pb-4">Premium Breakdown</h4>
                <div className="space-y-3 md:space-y-4">
                   <div className="flex justify-between items-center text-[9px] md:text-sm">
                     <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">Basic Policy Premium</span>
                     <span className="text-brand-text font-black font-mono">{formatCurrency(selectedProduct?.basePremium?.[input.paymentMethod] || 0)}</span>
                   </div>
                   {input.hasAccidentalProtection && (
                     <div className="flex justify-between items-center text-[9px] md:text-sm">
                       <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">Accidental Rider</span>
                       <span className="text-brand-text font-black font-mono">{formatCurrency(selectedProduct?.adbPremium?.[input.paymentMethod] || 0)}</span>
                     </div>
                   )}
                   {input.hasCIClassic && (
                     <div className="flex justify-between items-center text-[9px] md:text-sm">
                       <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">CI Classic Protection</span>
                       <span className="text-brand-text font-black font-mono">{formatCurrency(selectedProduct?.ciClassicPremium?.[input.paymentMethod] || 0)}</span>
                     </div>
                   )}
                   {input.hasCIStandard && (
                     <div className="flex justify-between items-center text-[9px] md:text-sm">
                       <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">Standard CI Protection</span>
                       <span className="text-brand-text font-black font-mono">{formatCurrency(selectedProduct?.ciStandardPremium?.[input.paymentMethod] || 0)}</span>
                     </div>
                   )}
                   <div className="pt-3 md:pt-4 border-t border-brand-primary/10 flex justify-between items-center">
                     <span className="text-brand-text font-black uppercase text-[8px] md:text-[10px] tracking-widest">Total Commitment ({input.paymentMethod})</span>
                     <span className="text-lg md:text-3xl font-black text-brand-text font-mono">{formatCurrency(selectedProduct?.totalPremium?.[input.paymentMethod] || 0)}</span>
                    </div>

                    {/* Total Term Cost Breakdown */}
                    <div className="pt-5 mt-5 border-t border-dashed border-brand-primary/20 space-y-3">
                      <h5 className="text-[10px] md:text-[11px] text-slate-400 font-black uppercase tracking-[0.1em] md:tracking-[0.2em] mb-2">Total Term Commitment ({input.term} Years)</h5>
                      
                      <div className="flex justify-between items-center text-[9px] md:text-sm">
                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">Total Pay for Basic</span>
                        <span className="text-brand-text font-black font-mono">{formatCurrency(totalTermBasePremium)}</span>
                      </div>
                      
                      {(input.hasAccidentalProtection || input.hasCIClassic || input.hasCIStandard) && (
                        <div className="flex justify-between items-center text-[9px] md:text-sm">
                          <span className="text-slate-500 font-bold uppercase tracking-widest text-[7px] md:text-xs">Total Pay for Rider</span>
                          <span className="text-brand-text font-black font-mono">{formatCurrency(totalTermRiderPremium)}</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-brand-primary/10 flex justify-between items-center">
                        <span className="text-brand-text font-black uppercase text-[8px] md:text-[10px] tracking-widest">Total Cumulative Pay</span>
                        <span className="text-base md:text-2xl font-black text-brand-primary font-mono">{formatCurrency(totalTermPaidPremium)}</span>
                      </div>
                    </div>
                 </div>
              </div>

              <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-2xl md:rounded-[2.5rem] p-4 md:p-10 space-y-4 md:space-y-6 relative overflow-hidden flex flex-col justify-center">
                 <div className="absolute top-0 right-0 p-3 md:p-4 opacity-10">
                   <Sparkles className="w-6 h-6 md:w-10 md:h-10 text-brand-primary" />
                 </div>
                 <h4 className="text-[11px] md:text-[12px] text-brand-primary font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">Maturity Summary</h4>
                 {(selectedProductId === 's3pp' || selectedProductId === 's4pp') ? (
                   <div className="space-y-2 md:space-y-4 pt-1 md:pt-2">
                     {getMaturitySchedule(selectedProductId).map((stage, idx) => (
                        <div key={idx} className="flex flex-col gap-1 border-b border-brand-primary/10 pb-3 last:border-0 last:pb-0">
                           <div className="flex justify-between items-center">
                              <span className="text-[9px] md:text-[10px] text-brand-primary font-black uppercase tracking-widest">{stage.label}</span>
                              <span className="text-[11px] md:text-[12px] text-slate-400 font-black">{stage.year}</span>
                           </div>
                           <h5 className="text-xl md:text-2xl font-black text-brand-text tracking-tight font-mono">{formatCurrency(stage.amount)}</h5>
                        </div>
                     ))}
                   </div>
                 ) : (
                   <div className="space-y-2 md:space-y-4">
                      <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest italic">Projected maturity at {input.term} years</p>
                     <h3 className="text-2xl md:text-3xl font-black text-brand-primary tracking-tighter font-mono">
                        {formatCurrency(maturityValue)}
                     </h3>
                   </div>
                 )}
              </div>
           </div>

              {isChildPlan && (
                <div className="pt-4 border-t border-brand-primary/10 space-y-2">
                   <p className="text-[9px] text-brand-gold font-black uppercase tracking-widest">Education Stipend Benefit</p>
                   <div className="bg-brand-gold/5 p-4 md:p-6 rounded-xl md:rounded-2xl border border-brand-gold/20 shadow-sm shadow-brand-gold/5">
                      <p className="text-[11px] text-brand-gold font-black uppercase mb-1">Guaranteed Monthly Payout</p>
                      <h5 className="text-xl md:text-2xl font-black text-brand-gold tracking-tight">{formatCurrency(childStipend)}</h5>
                      <p className="text-[9px] text-brand-gold/60 font-bold mt-2 leading-relaxed">This amount will be paid every month to support education costs until the policy matures.</p>
                   </div>
                </div>
              )}

            {/* Section 2: Cards 50/50 */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-8">
              {/* Family Protection */}
              <div className="bg-brand-dark/70 backdrop-blur-md border border-brand-primary/10 rounded-xl md:rounded-[2.5rem] p-3 md:p-8 space-y-3 md:space-y-8 relative overflow-hidden shadow-sm">
                 <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-red-500" />
                 <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-6 h-6 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-red-500/10 flex items-center justify-center">
                       <Shield className="w-3 h-3 md:w-6 md:h-6 text-red-500" />
                     </div>
                     <h5 className="text-[13px] md:text-xl font-black text-brand-text tracking-tight uppercase">Family Protection</h5>
                  </div>

                  <div className="space-y-2">
                     <ul className="space-y-1.5 md:space-y-4 bg-brand-dark/50 rounded-xl md:rounded-3xl p-2 md:p-6 border border-brand-primary/10">
                       <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                          <span className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest">Natural Death</span>
                          <span className="text-[13px] md:text-xl font-black text-brand-text">{formatCurrency(input.sumAssured)}</span>
                          <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">Guaranteed Death Benefit</span>
                       </li>
                       {isChildPlan && (
                         <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                            <span className="text-[11px] md:text-[12px] font-black uppercase tracking-widest text-brand-gold">Child Education Monthly Stipend</span>
                            <span className="text-[13px] md:text-xl font-black text-brand-gold">{formatCurrency(childStipend)} / Month</span>
                            <span className="text-[11px] md:text-[12px] text-brand-gold/70 font-bold uppercase mt-0.5">
                              {selectedProductId.split('_').pop() || '1'}% of SA Paid Monthly Upon Death Until Maturity
                            </span>
                         </li>
                       )}
                       {input.hasAccidentalProtection && (
                         <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                           <span className="text-[11px] md:text-[12px] font-black uppercase tracking-widest text-brand-primary">Accidental Death</span>
                           <span className="text-[13px] md:text-xl font-black text-brand-text">{formatCurrency(input.sumAssured * 2)}</span>
                           <span className="text-[11px] md:text-[12px] text-brand-primary/70 font-bold uppercase mt-0.5">200% Payout Benefit</span>
                         </li>
                       )}
                     </ul>
                  </div>
              </div>

              {/* Living Benefits */}
              <div className="bg-brand-dark/70 backdrop-blur-md border border-brand-primary/10 rounded-xl md:rounded-[2.5rem] p-3 md:p-8 space-y-3 md:space-y-8 relative overflow-hidden shadow-sm">
                 <div className="absolute top-0 left-0 w-1 md:w-2 h-full bg-brand-primary" />
                 <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-6 h-6 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-brand-primary/10 flex items-center justify-center">
                       <Activity className="w-3 h-3 md:w-6 md:h-6 text-brand-primary" />
                    </div>
                    <h5 className="text-[14px] md:text-xl font-black text-brand-text tracking-tight uppercase">Living Benefits</h5>
                 </div>

                 <div className="space-y-2">
                    <div className="space-y-2">
                       <ul className="space-y-1.5 md:space-y-4 bg-brand-dark/50 rounded-xl md:rounded-3xl p-2 md:p-6 border border-brand-primary/10">
                         {input.hasAccidentalProtection && (
                           <>
                             <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest">Medical Reimbursement</span>
                                <span className="text-[14px] md:text-xl font-black text-brand-text">{formatCurrency(input.sumAssured * 0.15)}</span>
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">Accidental Injury (15%)</span>
                             </li>
                             <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest">Total Disability</span>
                                <span className="text-[14px] md:text-xl font-black text-brand-text">{formatCurrency(input.sumAssured)}</span>
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">100% Accidental Coverage</span>
                             </li>
                             <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest">Partial Disability</span>
                                <span className="text-[14px] md:text-xl font-black text-brand-text">{formatCurrency(input.sumAssured)}</span>
                                <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">Scale of SA Benefit</span>
                             </li>
                           </>
                         )}
                         {(input.hasCIClassic || input.hasCIStandard) && (
                           <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                              <span className="text-[11px] md:text-[12px] text-slate-400 font-black uppercase tracking-widest">Primary Policy Critical Protection</span>
                              <span className="text-[14px] md:text-xl font-black text-brand-text">{formatCurrency(Math.min(input.sumAssured * 0.5, 3000000))}</span>
                              <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">50% SA Rider Protection</span>
                            </li>
                          )}
                          {isSDPP && (sdppData?.ciCoverage || 0) > 0 && (
                            <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                               <span className="text-[11px] md:text-[12px] text-brand-gold font-black uppercase tracking-widest">SDPP Critical Illness Coverage</span>
                               <span className="text-[14px] md:text-xl font-black text-brand-gold">{formatCurrency(sdppData?.ciCoverage || 0)}</span>
                               <span className="text-[11px] md:text-[12px] text-brand-gold/70 font-bold uppercase mt-0.5">SDPP Plan Coverage</span>
                            </li>
                          )}
                          {(input.hasCIClassic || input.hasCIStandard) && isSDPP && (sdppData?.ciCoverage || 0) > 0 && (
                            <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                               <span className="text-[11px] md:text-[12px] text-brand-gold font-black uppercase tracking-widest">Total Combined Critical Protection</span>
                               <span className="text-[14px] md:text-xl font-black text-brand-gold">{formatCurrency(Math.min(input.sumAssured * 0.5, 3000000) + (sdppData?.ciCoverage || 0))}</span>
                               <span className="text-[11px] md:text-[12px] text-brand-gold/70 font-bold uppercase mt-0.5">Primary Rider + SDPP Combined Coverage</span>
                           </li>
                         )}

                         {/* Tax Rebate Benefit */}
                         <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                            <span className="text-[11px] md:text-[12px] text-emerald-400 font-black uppercase tracking-widest">Tax Rebate Benefit</span>
                            <span className="text-[14px] md:text-xl font-black text-emerald-400">{formatCurrency(Math.round((selectedProduct?.totalPremium?.['Yearly'] || 0) * 0.10))}</span>
                            <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">Estimated 10% Annual Income Tax Savings</span>
                         </li>

                         {/* Partner Hospital Discount */}
                         <li className="flex flex-col gap-0 border-b border-brand-primary/10 pb-2 md:pb-4 last:border-0 last:pb-0">
                            <span className="text-[11px] md:text-[12px] text-brand-gold font-black uppercase tracking-widest">Partner Hospital Discount</span>
                            <span className="text-[14px] md:text-xl font-black text-brand-gold">Up to 40%</span>
                            <span className="text-[11px] md:text-[12px] text-slate-400 font-bold uppercase mt-0.5">At Partner Hospitals & Healthcare Centers</span>
                         </li>
                       </ul>
                    </div>
                 </div>
              </div>
            </div>
          </div>

        {/* Year-Wise Trajectory (Excluded for SDPP) */}
        {!isSDPP && !isSDPPResult && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-brand-text tracking-tighter uppercase">Policy Trajectory</h3>
                <p className="text-[12px] text-slate-400 font-black uppercase tracking-widest italic">Year-Wise Projection & Liquidity Analysis</p>
              </div>
              <button 
                onClick={() => setShowEmergency(!showEmergency)}
                className="px-6 py-3 bg-brand-gold/10 border border-brand-gold/20 rounded-full text-[12px] font-black text-brand-gold uppercase tracking-widest hover:bg-brand-gold/20 transition-all flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {showEmergency ? 'Simplify View' : 'Liquidity View'}
              </button>
            </div>

            <AnimatePresence>
              {showEmergency && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                   {renderProjectionTable()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <footer className="pt-20 border-t border-slate-200 text-center space-y-6">
          <div className="flex justify-center flex-col items-center gap-4">
            <p className="text-[12px] text-slate-400 font-black uppercase tracking-[0.5em] italic">Valuation Engine PLC</p>
          </div>
          <div className="flex justify-center gap-8">
             <div className="flex items-center gap-2 text-[11px] text-brand-text font-black uppercase">
                <Shield className="w-3 h-3 text-brand-primary" /> Fully Regulated
             </div>
             <div className="flex items-center gap-2 text-[11px] text-brand-text font-black uppercase">
                <Zap className="w-3 h-3 text-brand-primary" /> Real-time Execution
             </div>
          </div>
        </footer>
      </div>
    );
  };

  return (
    <div className="sdpp-app min-h-screen bg-brand-dark text-brand-text font-sans relative">
      <header className="sdpp-topbar relative z-30 print:hidden">
        <div className="sdpp-topbar-inner"><img src="/shanta-life-logo.png" alt="Shanta Life" className="h-10 w-auto max-w-28 object-contain flex-shrink-0" /><div><strong>Premium Pulse</strong><span>Policy & premium valuation dashboard</span></div><span className="sdpp-version">SDPP-inspired interface</span></div>
      </header>

      <AnimatePresence mode="wait">
        {appState === 'home' ? (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
            {renderHome()}
          </motion.div>
        ) : (
          <motion.div 
            key={appState}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "relative z-10 flex flex-col w-full min-h-[100dvh] items-center justify-center px-3 sm:px-4 md:px-6 transition-all duration-300",
              appState === 'inputs' ? "py-4 sm:py-6 md:py-8 my-auto" : "py-6 md:py-12"
            )}
          >
            <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto flex flex-col justify-center my-auto">
              <AnimatePresence mode="wait">
                {appState === 'inputs' ? (
                  <motion.div 
                    key="inputs-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex justify-center items-center my-auto"
                  >
                    <div className="w-full my-auto">
                      {renderInputs()}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="results-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full"
                  >
                    <div className="flex items-center justify-between mb-5"><button onClick={() => {setAppState('inputs');setWizardStep(3);}} className="flex items-center gap-2 rounded-xl border border-[#e5e8df] bg-white px-3 py-2 text-sm"><ArrowLeft className="w-4 h-4"/> Back</button><h2 className="text-lg font-bold text-brand-text">Quotation Preview</h2><span className="w-14"/></div>
                    <div className="grid grid-cols-4 gap-2 mb-5 rounded-2xl border border-[#e5e8df] bg-white p-2">
                      {([{id:'quotation',label:'Quotation',Icon:FileText},{id:'term',label:'Term Comparison',Icon:BarChart3},{id:'policy',label:'Policy Comparison',Icon:ArrowLeftRight},{id:'liquidity',label:'Liquidity',Icon:Activity}] as const).map(({id,label,Icon})=><button key={id} type="button" onClick={()=>{setPreviewSection(id);setLiquidityDetails(false);}} className={cn('min-h-16 flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] sm:text-xs font-semibold',previewSection===id?'bg-brand-primary text-white':'bg-[#f7f8ef] text-brand-text')}><Icon className="w-5 h-5"/><span className="text-center leading-tight">{label}</span></button>)}
                    </div>
                    {liquidityDetails && previewSection === 'liquidity' ? <div className="rounded-2xl bg-white border border-[#e5e8df] p-4 space-y-4"><button onClick={()=>setLiquidityDetails(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">← Back to Liquidity</button><h3 className="font-bold text-brand-text">Policy Value Projection Trajectory</h3><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs text-left"><thead><tr className="bg-[#f0f1df]">{['End of Year','Base Premium','Natural Death','Surrender Value','Paid Up Value','ETI Benefits'].map(label=><th key={label} className="p-2 border">{label}</th>)}</tr></thead><tbody>{projectionData.map(row=><tr key={row.year}><td className="p-2 border">{row.year}</td><td className="p-2 border">{row.premium>0?formatCurrency(row.premium):'—'}</td><td className="p-2 border">{formatCurrency(row.deathBenefit||input.sumAssured)}</td><td className="p-2 border">{row.surrenderValue>0?formatCurrency(row.surrenderValue):'—'}</td><td className="p-2 border">{row.paidUpValue>0?formatCurrency(row.paidUpValue):'—'}</td><td className="p-2 border">{row.etiDurationStr||'—'}</td></tr>)}</tbody></table></div></div> : previewSection === 'quotation' ? (<>

                      <PlanQuotationModal
                        embedded
                        showProjection={false}
                        isOpen={true}
                        onClose={() => setAppState('inputs')}
                        input={input}
                        selectedProduct={selectedProduct}
                        sdppData={sdppData}
                        isComboEnabled={isComboEnabled}
                        sdppComboData={sdppComboData}
                        comboSdppPlan={comboSdppPlan}
                        comboSdppPaymentMethod={comboSdppPaymentMethod}
                        comboSdppDeposit={comboSdppDeposit}
                        projectionData={projectionData}
                      />
                    </>) : previewSection === 'term' ? <div className="rounded-2xl border border-[#e5e8df] bg-white p-5 space-y-4"><h3 className="font-bold">Term Comparison</h3><p className="text-sm text-slate-600">Compare available policy terms and download the detailed comparison.</p><button onClick={()=>setShowTermComparisonModal(true)} className="w-full rounded-xl bg-brand-primary py-3 font-semibold text-white">View Details →</button></div> : previewSection === 'policy' ? <div className="space-y-4"><div className="rounded-2xl border border-[#e5e8df] bg-white p-5 space-y-3"><h3 className="font-bold">Policy Comparison</h3><button onClick={()=>setIsCompareMode(v=>!v)} className="w-full rounded-xl bg-brand-primary py-3 font-semibold text-white">{isCompareMode?'Hide Details':'View Details →'}</button></div>{isCompareMode && renderCompareMode()}</div> : <div className="rounded-2xl border border-[#e5e8df] bg-white p-5 space-y-4"><h3 className="font-bold">Liquidity View</h3><p className="text-sm text-slate-600">Explore the year-wise policy projection and its available values.</p><button onClick={()=>setLiquidityDetails(true)} className="w-full rounded-xl bg-brand-primary py-3 font-semibold text-white">View Detailed Projection →</button></div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PlanQuotationModal
        isOpen={showQuotationModal}
        onClose={() => setShowQuotationModal(false)}
        input={input}
        selectedProduct={selectedProduct}
        sdppData={sdppData}
        isComboEnabled={isComboEnabled}
        sdppComboData={sdppComboData}
        comboSdppPlan={comboSdppPlan}
        comboSdppPaymentMethod={comboSdppPaymentMethod}
        comboSdppDeposit={comboSdppDeposit}
        projectionData={projectionData}
      />

      <TermComparisonModal
        isOpen={showTermComparisonModal}
        onClose={() => setShowTermComparisonModal(false)}
        input={input}
        selectedProduct={selectedProduct}
        sdppData={sdppData}
        isComboEnabled={isComboEnabled}
        comboSdppPlan={comboSdppPlan}
        comboSdppDeposit={comboSdppDeposit}
        comboSdppPaymentMethod={comboSdppPaymentMethod}
        currentRules={currentRules}
        onSelectTerm={(newTerm) => handleInputChange('term', newTerm)}
      />
    </div>
  );
}
