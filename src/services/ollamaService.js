import { formatInvoicePrompt, parseInvoiceResponse } from './invoiceExtractor';

const API_URL = 'http://135.224.195.180:11434/api/chat';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to clean and validate base64 string
const cleanBase64 = (base64String) => {
  // Remove any whitespace
  base64String = base64String.trim();
  // Remove data URL prefix if present
  if (base64String.includes(',')) {
    base64String = base64String.split(',')[1];
  }
  // Ensure the string is properly padded
  while (base64String.length % 4) {
    base64String += '=';
  }
  return base64String;
};

export const processImageWithRetry = async (base64Image, onProgress) => {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const cleanedBase64 = cleanBase64(base64Image);
      
      const requestBody = {
        model: 'llama3.2-vision',
        messages: [{
          role: 'user',
          content: `You are a precise invoice data extractor. First, identify the currency from any currency symbols (₹,$,€,£) or currency names in the invoice. Then extract ALL text from the invoice image, including every detail you can see. Organize the information into two parts:

Part 1 - Required Fields (format exactly as shown, DO NOT add currency symbols to amounts):
Invoice number: [exact value or "not available"]
Invoice Date: [DD/MM/YYYY or "not available"]
Invoice Amount: [number only without currency symbol, e.g. "200000.00" or "not available"]
Currency: [Use format: "₹ (Indian Rupee)" for INR, "$ (US Dollar)" for USD, "€ (Euro)" for EUR, "£ (British Pound)" for GBP]
Legal Entity Name: [exact name or "not available"]
Legal Entity Address: [full address or "not available"]
Vendor Name: [exact name or "not available"]
Vendor Address: [full address or "not available"]
Payment Terms: [exact terms or "not available"]
Payment Method: [exact method or "not available"]
VAT ID: [exact number or "not available"]
GL Account Number: [exact number or "not available"]
Bank Account Number: [exact number or "not available"]

Part 2 - Additional Information:
[List ALL other information found in the invoice, including but not limited to:
- Line items and their details
- Tax breakdowns
- Shipping information
- Contact details
- Terms and conditions
- Notes or comments
- Any other text or numbers visible in the invoice]

Format Part 2 as a clear, structured list of all additional information found.`,
          images: [cleanedBase64]
        }],
        stream: true,
        options: {
          temperature: 0.1,
          max_tokens: 2048
        }
      };

      // Log request details for debugging
      console.log('Request URL:', API_URL);
      console.log('Request headers:', {
        'Content-Type': 'application/json'
      });
      console.log('Request body structure:', {
        model: requestBody.model,
        messageCount: requestBody.messages.length,
        firstMessageContent: typeof requestBody.messages[0].content,
        hasImages: !!requestBody.messages[0].images,
        imageCount: requestBody.messages[0].images?.length,
        imageSize: requestBody.messages[0].images[0].length,
        options: requestBody.options
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      let fullText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              fullText += json.message.content;
              // Only call onProgress if it's a progress update
              if (onProgress && json.message.content.includes('Processing')) {
                onProgress(json.message.content);
              }
            }
          } catch (e) {
            console.warn('Error parsing chunk:', e);
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text was extracted from the image');
      }

      console.log('Raw extracted text:', fullText);

      // Clean the full text before parsing
      fullText = fullText
        .replace(/```[^`]*```/g, '')     // Remove code blocks
        .replace(/\*\*/g, '')            // Remove all ** markers
        .replace(/#+\s/g, '')            // Remove headers
        .replace(/\n\s*\n/g, '\n')       // Remove empty lines
        .replace(/^Invoice (?:Information|Analysis|Data Extraction)\s*/i, '')  // Remove any headers
        .replace(/^Based on.*?\n/i, '')  // Remove "Based on..." line
        .replace(/Note:.*$/s, '')        // Remove note section at the end
        .replace(/^\d+\.\s*/gm, '')      // Remove numbered list markers
        .replace(/^\*\s*/gm, '')         // Remove bullet points
        .replace(/^-\s*/gm, '')          // Remove dashes
        .replace(/\[|\]/g, '')           // Remove square brackets
        .replace(/\s{2,}/g, ' ')         // Replace multiple spaces with single
        .trim();

      console.log('Cleaned text:', fullText);

      // Ensure the text has the correct format
      if (!fullText.includes(':')) {
        console.error('Invalid response format - no fields found');
        throw new Error('Invalid response format from OCR service');
      }

      // Parse the cleaned text
      const result = parseInvoiceResponse(fullText);
      
      // Add the full text for chat functionality
      result.fullText = fullText;
      
      // Validate the result
      if (!result || Object.values(result).every(v => v === 'not available')) {
        console.error('Extraction failed - all fields are not available');
        throw new Error('Failed to extract any information from the image');
      }

      console.log('Final processed result:', result);
      return result;
    } catch (error) {
      retries++;
      console.error(`Attempt ${retries} failed:`, error);
      
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
      } else {
        throw error;
      }
    }
  }
};
