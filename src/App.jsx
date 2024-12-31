import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { PhotoIcon, ClockIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { processImageWithRetry } from './services/ollamaService';
import { convertPDFToImage, mergePageResults } from './services/pdfService';
import ChatInterface from './components/ChatInterface';
import { UI_FIELD_MAPPING, FIELD_VALIDATION, FIELD_FORMATTERS } from './config/fieldConfig';

function App() {
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [imageFiles, setImageFiles] = useState(null);

  const processFile = async (file) => {
    setLoading(true);
    setError(null);
    setImageFiles(null);

    try {
      let imageFiles = [];
      
      // If file is PDF, convert to image(s)
      if (file.type === 'application/pdf') {
        const convertedFiles = await convertPDFToImage(file);
        imageFiles = Array.isArray(convertedFiles) ? convertedFiles : [convertedFiles];
      } else {
        imageFiles = [file];
      }

      setImageFiles(imageFiles);

      // Process each page
      const pageResults = [];
      
      for (let i = 0; i < imageFiles.length; i++) {
        // Only show page numbers for multi-page documents
        if (imageFiles.length > 1) {
          setProgress(`Processing page ${i + 1} of ${imageFiles.length}`);
        } else {
          setProgress('Processing your invoice...');
        }
        
        try {
          // Convert file to base64
          const base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(imageFiles[i]);
          });
          
          const text = await processImageWithRetry(base64Image, (progress) => {
            // Only update progress for multi-page PDFs
            if (imageFiles.length > 1) {
              setProgress(`Processing page ${i + 1} of ${imageFiles.length}`);
            }
          });
          
          pageResults.push(text);
        } catch (pageError) {
          pageResults.push(null);
        }
      }
      
      // Handle single page vs multiple pages
      let extractedData;
      if (imageFiles.length === 1) {
        // For single page, ensure we map the fields correctly
        extractedData = mergePageResults(pageResults[0]);
        console.log('Single page extracted data:', extractedData);
      } else {
        // For multiple pages, merge the results
        extractedData = mergePageResults(pageResults);
        console.log('Multiple page extracted data:', extractedData);
      }
      
      // Validate extracted data
      if (!extractedData || Object.values(extractedData).every(v => v === 'not available')) {
        console.error('Extraction failed - no valid data:', extractedData);
        throw new Error('Failed to extract any information from the document');
      }

      console.log('Final processed data:', extractedData);

      const result = {
        id: Date.now(),
        extractedData,
        timestamp: new Date().toLocaleString(),
        images: imageFiles.map(file => URL.createObjectURL(file)),
        filename: file.name,
        pageCount: imageFiles.length
      };

      setCurrentResult(result);
      setHistory(prev => [result, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    await processFile(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const ResultDisplay = ({ result }) => {
    if (!result) return null;

    const formatFieldValue = (key, value) => {
      const displayName = UI_FIELD_MAPPING[key];
      const formatter = FIELD_FORMATTERS[displayName];
      return formatter ? formatter(value) : value;
    };

    const isFieldValid = (key, value) => {
      const displayName = UI_FIELD_MAPPING[key];
      const validator = FIELD_VALIDATION[displayName];
      return validator ? validator(value) : true;
    };

    return (
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-[1px] rounded-xl mt-8">
        <div className="bg-gray-900/70 backdrop-blur-md rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-200">Extracted Information</h3>
            {result.pageCount > 1 && (
              <span className="text-sm text-gray-400">
                Processed {result.pageCount} pages
              </span>
            )}
          </div>
          
          {/* Image Preview */}
          {result.images && result.images.length > 0 && (
            <div className="mb-6 overflow-x-auto">
              <div className="flex space-x-4 justify-center">
                {result.images.map((image, index) => (
                  <div key={index} className="relative min-w-[200px]">
                    <img 
                      src={image} 
                      alt={`Page ${index + 1}`} 
                      className="border border-blue-500/20 rounded-lg"
                      style={{ maxHeight: '200px', objectFit: 'contain' }}
                    />
                    <span className="absolute bottom-2 right-2 bg-gray-900/80 text-gray-200 text-xs px-2 py-1 rounded">
                      Page {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <tbody>
                {Object.entries(UI_FIELD_MAPPING).map(([key, displayName]) => {
                  const value = result.extractedData[key];
                  const isValid = isFieldValid(key, value);
                  const formattedValue = formatFieldValue(key, value);
                  
                  return (
                    <tr key={key}>
                      <th className="bg-blue-900/30 text-left p-4 border border-blue-500/20 font-medium text-gray-200 w-1/3">
                        {displayName}
                      </th>
                      <td className={`p-4 border border-blue-500/20 ${isValid ? 'text-gray-300' : 'text-red-400'}`}>
                        {formattedValue}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Add Chat Interface */}
          <ChatInterface invoiceData={result.extractedData} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-8">
          Invoice OCR Extractor
        </h1>

        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-[1px] rounded-xl">
            <div 
              {...getRootProps()} 
              className={`
                bg-gray-900/70 backdrop-blur-md rounded-xl p-8 text-center
                transition-all duration-200 ease-in-out
                ${isDragActive ? 'scale-[1.02] bg-gray-900/80' : 'hover:bg-gray-900/80'}
              `}
            >
              <input {...getInputProps()} />
              <div className="text-center">
                <PhotoIcon className="mx-auto h-12 w-12 text-blue-400" />
                <p className="mt-4 text-lg text-gray-200">
                  {isDragActive 
                    ? "Drop the invoice here..." 
                    : "Drag and drop an invoice, or click to select"
                  }
                </p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-blue-500/20">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5 text-blue-400 animate-spin" />
                  {imageFiles?.length > 1 ? (
                    <p className="text-gray-300">{progress}</p>
                  ) : (
                    <p className="text-gray-300">Processing your invoice...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 rounded-lg border border-red-500/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                  <p className="text-red-400">{error}</p>
                </div>
                <button
                  onClick={() => processFile(currentResult?.image)}
                  className="flex items-center space-x-1 px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}

          {currentResult && <ResultDisplay result={currentResult} />}

          {history.length > 0 && (
            <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-500 p-[1px] rounded-xl">
              <div className="bg-gray-900/70 backdrop-blur-md rounded-xl p-6">
                <h2 className="text-xl font-semibold text-gray-200 mb-4">History</h2>
                <div className="space-y-4">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-gray-900/50 backdrop-blur-md rounded-lg p-4 hover:bg-gray-900/60 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-200">{item.filename}</h4>
                          <p className="text-sm text-gray-400">{item.timestamp}</p>
                        </div>
                        <button 
                          onClick={() => setCurrentResult(item)}
                          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
