// Test-only entry point; not referenced by index.html or included in the production build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PlanQuotationModal from '../src/components/PlanQuotationModal';
import { quotationFixture } from './fixtures';
import '../src/index.css';
const options = quotationFixture();
createRoot(document.getElementById('root')!).render(<PlanQuotationModal {...options} isOpen embedded showProjection={false} onClose={() => {}} />);
