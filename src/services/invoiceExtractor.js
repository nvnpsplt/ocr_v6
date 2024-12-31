import { FIELD_VARIATIONS, FIELD_MAPPINGS } from '../config/fieldConfig';

const CURRENCY_SYMBOLS = {
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP'
};

const formatAmount = (amount, currency) => {
  // If amount is "not available", return as is
  if (amount.toLowerCase() === 'not available') {
    return amount;
  }

  try {
    // Remove all non-numeric characters except decimal point and negative sign
    const cleanAmount = amount.replace(/[^0-9.-]/g, '');
    
    // Parse the amount to a number and format without currency symbol
    const numAmount = parseFloat(cleanAmount);
    
    // Check if it's a valid number
    if (isNaN(numAmount)) {
      console.error('Invalid amount:', amount);
      return 'not available';
    }
    
    return numAmount.toLocaleString('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: true,
    });
  } catch (e) {
    console.error('Error formatting amount:', e);
    return 'not available';
  }
};

export const formatInvoicePrompt = () => {
  return `You are an invoice data extraction assistant. Extract the following information from the invoice image in a structured format. For any field that is not found in the image, write "not available".

Please extract:
1. Invoice number
2. Invoice Date
3. Invoice Amount
4. Currency
5. Legal Entity Name
6. Legal Entity Address
7. Vendor Name
8. Vendor Address
9. Payment Terms
10. Payment Method
11. VAT ID
12. GL Account Number
13. Bank Account Number

Format your response as:
Invoice number: [value]
Invoice Date: [value]
Invoice Amount: [value]
Currency: [value]
Legal Entity Name: [value]
Legal Entity Address: [value]
Vendor Name: [value]
Vendor Address: [value]
Payment Terms: [value]
Payment Method: [value]
VAT ID: [value]
GL Account Number: [value]
Bank Account Number: [value]`;
};

export const parseInvoiceResponse = (response) => {
  console.log('Starting to parse response:', response);
  
  const result = {};
  let additionalInfo = '';
  
  // Split into parts
  const parts = response.split('Part 2 - Additional Information:');
  const structuredPart = parts[0];
  if (parts.length > 1) {
    additionalInfo = parts[1].trim();
  }

  // Process structured fields
  const lines = structuredPart.split('\n')
    .map(line => line.trim())
    .filter(line => line && 
      !line.startsWith('Part 1') && 
      !line.startsWith('Based on') && 
      !line.startsWith('Note:'));

  console.log('Processing structured lines:', lines);
  
  // First pass: find currency
  let detectedCurrency = null;
  lines.forEach((line) => {
    if (line.toLowerCase().includes('currency:')) {
      const value = line.split(':')[1].trim();
      // Look for currency symbols in the value
      for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
        if (value.includes(symbol) || value.toLowerCase().includes(code.toLowerCase())) {
          detectedCurrency = { symbol, code };
          break;
        }
      }
    }
  });

  // Process each line
  lines.forEach((line) => {
    if (!line.includes(':')) return;

    line = line
      .replace(/^\*\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^\-\s*/, '')
      .trim();

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    let fieldPart = line.substring(0, colonIndex).trim().toLowerCase();
    let valuePart = line.substring(colonIndex + 1).trim();

    // Find matching field using variations
    let matchedField = null;
    for (const [baseField, variations] of Object.entries(FIELD_VARIATIONS)) {
      if (variations.includes(fieldPart)) {
        matchedField = baseField;
        break;
      }
    }

    if (matchedField) {
      const fieldName = FIELD_MAPPINGS[matchedField];
      
      let cleanValue = valuePart
        .replace(/^\[|\]$/g, '')
        .replace(/^\*\*|\*\*$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();
      
      const notAvailable = cleanValue.toLowerCase() === 'not available' || 
                          cleanValue.toLowerCase() === 'n/a' ||
                          cleanValue.toLowerCase() === 'none' ||
                          cleanValue === '-' ||
                          !cleanValue;
      
      // Special handling for amount and currency
      if (fieldName === 'invoiceAmount' && !notAvailable && detectedCurrency) {
        cleanValue = formatAmount(cleanValue, detectedCurrency.code);
      } else if (fieldName === 'currency' && detectedCurrency) {
        cleanValue = `${detectedCurrency.symbol} (${detectedCurrency.code})`;
      }
      
      result[fieldName] = notAvailable ? 'not available' : cleanValue;
      console.log(`Matched field "${fieldName}" (from "${fieldPart}"):`, result[fieldName]);
    } else {
      console.warn('Unmatched field:', fieldPart);
    }
  });

  // Fill in missing fields with default values
  Object.values(FIELD_MAPPINGS).forEach(field => {
    if (!result[field]) {
      result[field] = 'not available';
      console.log(`Field "${field}" not found in response, setting to default`);
    }
  });

  // Add additional information
  if (additionalInfo) {
    result.additionalInformation = additionalInfo;
    console.log('Added additional information:', additionalInfo);
  }

  console.log('Final extracted result:', result);
  return result;
};
