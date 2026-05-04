import { createContext, useContext, useState } from "react";

const AnalyzerContext = createContext(null);

export function AnalyzerProvider({ children }) {
  const [results, setResults] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [inputCollapsed, setInputCollapsed] = useState(false);

  return (
    <AnalyzerContext.Provider
      value={{ results, setResults, uploadedCount, setUploadedCount, inputCollapsed, setInputCollapsed }}
    >
      {children}
    </AnalyzerContext.Provider>
  );
}

export function useAnalyzer() {
  return useContext(AnalyzerContext);
}
