// Field variations for matching
export const FIELD_VARIATIONS = {
  'invoice number': ['invoice number', 'invoice no', 'invoice no.', 'invoice #', 'inv no', 'inv.no', 'inv #'],
  'invoice date': ['invoice date', 'date', 'inv date', 'invoice dt'],
  'invoice amount': ['invoice amount', 'total amount', 'amount', 'total', 'grand total'],
  'currency': ['currency', 'curr', 'currency type'],
  'legal entity name': ['legal entity name', 'company name', 'business name', 'entity name'],
  'legal entity address': ['legal entity address', 'company address', 'business address', 'address'],
  'vendor name': ['vendor name', 'customer name', 'client name', 'billed to', 'bill to'],
  'vendor address': ['vendor address', 'customer address', 'client address', 'billing address'],
  'payment terms': ['payment terms', 'terms', 'payment condition', 'due terms'],
  'payment method': ['payment method', 'method of payment', 'pay method', 'payment type'],
  'vat id': ['vat id', 'vat number', 'vat reg no', 'gst no', 'tax id'],
  'gl account number': ['gl account number', 'gl number', 'general ledger', 'account number'],
  'bank account number': ['bank account number', 'account no', 'bank account', 'bank acc no']
};

// Standard field names for internal use
export const FIELD_MAPPINGS = {
  'invoice number': 'Invoice Number',
  'invoice date': 'Invoice Date',
  'invoice amount': 'Invoice Amount',
  'currency': 'Currency',
  'legal entity name': 'Legal Entity Name',
  'legal entity address': 'Legal Entity Address',
  'vendor name': 'Vendor Name',
  'vendor address': 'Vendor Address',
  'payment terms': 'Payment Terms',
  'payment method': 'Payment Method',
  'vat id': 'VAT ID',
  'gl account number': 'GL Account Number',
  'bank account number': 'Bank Account Number'
};

// UI display mapping
export const UI_FIELD_MAPPING = {
  'invoiceNumber': 'Invoice Number',
  'invoiceDate': 'Invoice Date',
  'invoiceAmount': 'Invoice Amount',
  'currency': 'Currency',
  'legalEntityName': 'Legal Entity Name',
  'legalEntityAddress': 'Legal Entity Address',
  'vendorName': 'Vendor Name',
  'vendorAddress': 'Vendor Address',
  'paymentTerms': 'Payment Terms',
  'paymentMethod': 'Payment Method',
  'vatId': 'VAT ID',
  'glAccountNumber': 'GL Account Number',
  'bankAccountNumber': 'Bank Account Number'
};

// Field validation rules
export const FIELD_VALIDATION = {
  'Invoice Number': (value) => value && value !== 'not available',
  'Invoice Date': (value) => {
    if (value === 'not available') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
  'Invoice Amount': (value) => {
    if (value === 'not available') return false;
    return !isNaN(parseFloat(value.replace(/[^0-9.-]+/g,"")));
  }
};

// Field display formatting
export const FIELD_FORMATTERS = {
  'Invoice Date': (value) => {
    if (value === 'not available') return value;
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  },
  'Invoice Amount': (value) => {
    if (value === 'not available') return value;
    try {
      const number = parseFloat(value.replace(/[^0-9.-]+/g,""));
      return new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true
      }).format(number);
    } catch {
      return value;
    }
  }
};
