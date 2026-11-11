# Hand labels for evals/data/classifier_heldout.json: 80 company filings drawn 12 Nov 2026 (seed 20261112)
# from the worker store, excluding every filing in the tuning sample and ETF NAV notices.
# Labelled from NSE's subject + summary only, before running the rules on them; the rules were not
# changed after seeing the result. Same conventions as classifier_labels.py.
# Correction 12 Nov: #7 (Titan change in auditors) relabelled routine, because ENAM's reference lists
# auditor appointments under 'unclassified' (routine). This corrects the label against the brief's own
# taxonomy, not towards the rules' output.
LABELS = {
 0: ("press_release|unclassified", None), 1: ("results", 1), 2: ("unclassified", 0), 3: ("earnings_call|investor_meetings", 0),
 4: ("investor_meetings", 0), 5: ("investor_meetings", 0), 6: ("press_release|m_and_a|capex", 1), 7: ("unclassified|management_change", 0),
 8: ("litigation", 1), 9: ("investor_meetings", 0), 10: ("results|unclassified", 0), 11: ("investor_meetings", 0),
 12: ("earnings_call", 1), 13: ("unclassified", 0), 14: ("earnings_call", 1), 15: ("investor_meetings", 0),
 16: ("investor_meetings", 0), 17: ("unclassified|fund_raise", 0), 18: ("management_change", 1), 19: ("earnings_call|investor_meetings", 0),
 20: ("m_and_a|unclassified", 0), 21: ("management_change", 1), 22: ("press_release", 1), 23: ("earnings_call", 1),
 24: ("unclassified", 0), 25: ("earnings_call", 1), 26: ("earnings_call", 1), 27: ("fund_raise|m_and_a", 1),
 28: ("unclassified|litigation|press_release", 1), 29: ("fund_raise|unclassified", 0), 30: ("m_and_a", 1), 31: ("investor_meetings", 0),
 32: ("investor_meetings", 0), 33: ("investor_meetings", 0), 34: ("results", 1), 35: ("earnings_call|investor_meetings", 0),
 36: ("postal_ballot|agm_egm", 0), 37: ("earnings_call", 1), 38: ("investor_meetings", 0), 39: ("fund_raise|unclassified", 0),
 40: ("earnings_call", 1), 41: ("credit_rating", 1), 42: ("results|unclassified", 0), 43: ("fund_raise|unclassified", 0),
 44: ("investor_meetings|unclassified", 0), 45: ("investor_meetings", 0), 46: ("investor_meetings", 0), 47: ("investor_meetings", 0),
 48: ("unclassified|litigation", 1), 49: ("m_and_a|unclassified", 0), 50: ("earnings_call", 1), 51: ("unclassified", None),
 52: ("results", 1), 53: ("earnings_call", 1), 54: ("unclassified", 0), 55: ("earnings_call", 1),
 56: ("investor_meetings", 0), 57: ("credit_rating", 1), 58: ("investor_meetings", 0), 59: ("capex", 1),
 60: ("investor_meetings", 0), 61: ("capex", 1), 62: ("unclassified|results", 0), 63: ("earnings_call", 1),
 64: ("capex", 1), 65: ("fund_raise", 1), 66: ("agm_egm|postal_ballot", 0), 67: ("unclassified|fund_raise", 0),
 68: ("press_release", 1), 69: ("m_and_a", 1), 70: ("press_release|unclassified", 0), 71: ("credit_rating|unclassified", 0),
 72: ("unclassified|litigation", 1), 73: ("investor_meetings", 0), 74: ("press_release", 0), 75: ("investor_meetings", 0),
 76: ("earnings_call", 1), 77: ("unclassified|litigation", 1), 78: ("results", 1), 79: ("management_change", 1),
}
