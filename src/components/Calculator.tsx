                    <>
                      <PlanQuotationModal
                        embedded
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
                    </>)}
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
