import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set worker path to match the installed version
GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.6.347/pdf.worker.min.js';

// Field mapping from extracted format to merged format
const MERGED_FIELD_MAPPING = {
  'Invoice Number': 'invoiceNumber',
  'Invoice Date': 'invoiceDate',
  'Invoice Amount': 'invoiceAmount',
  'Currency': 'currency',
  'Legal Entity Name': 'legalEntityName',
  'Legal Entity Address': 'legalEntityAddress',
  'Vendor Name': 'vendorName',
  'Vendor Address': 'vendorAddress',
  'Payment Terms': 'paymentTerms',
  'Payment Method': 'paymentMethod',
  'VAT ID': 'vatId',
  'GL Account Number': 'glAccountNumber',
  'Bank Account Number': 'bankAccountNumber'
};

export const convertPDFToImage = async (file) => {
  try {
    // Read the PDF file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    // Get total number of pages
    const numPages = pdf.numPages;
    const pages = [];
    
    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        
        // Set scale for better quality
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        
        // Prepare canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Convert canvas to blob
        const blob = await new Promise((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/png');
        });
        
        pages.push(new File([blob], `page${pageNum}.png`, { type: 'image/png' }));
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
      }
    }
    
    // Return array of pages (or single page for backwards compatibility)
    return pages.length === 1 ? pages[0] : pages;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw new Error('Failed to convert PDF to image');
  }
};

// Helper function to merge OCR results from multiple pages
export const mergePageResults = (results) => {
  // Initialize merged result object with default values
  const mergedResult = Object.values(MERGED_FIELD_MAPPING).reduce((acc, key) => {
    acc[key] = 'not available';
    return acc;
  }, {});

  // If single result (not array), convert it to the correct format
  if (!Array.isArray(results)) {
    console.log('Processing single page result:', results);
    Object.entries(results).forEach(([key, value]) => {
      const mergedKey = MERGED_FIELD_MAPPING[key];
      if (mergedKey && value !== 'not available') {
        mergedResult[mergedKey] = value;
      }
    });
    return mergedResult;
  }

  // Process multiple page results
  results.forEach((result, index) => {
    if (!result) return;
    
    console.log(`Merging result from page ${index + 1}:`, result);
    
    // Map fields using the fieldMapping
    Object.entries(result).forEach(([key, value]) => {
      const mergedKey = MERGED_FIELD_MAPPING[key];
      if (mergedKey && value !== 'not available') {
        mergedResult[mergedKey] = value;
      }
    });
  });

  console.log('Final merged result:', mergedResult);
  return mergedResult;
};
