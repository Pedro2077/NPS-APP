import React, { useState, useEffect } from 'react';
import NPSSystem from './NPSSystem';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Aplicar tema no documento
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2 className="loading-text">Sistema NPS</h2>
          <p className="loading-subtitle">Carregando análise avançada...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App" data-theme={theme}>
      {/* Theme Toggle Button */}
      <button 
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label="Alternar tema"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      
      {/* Main Application */}
      <NPSSystem />
      
      {/* Scroll to top button */}
      <button 
        className="scroll-to-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Voltar ao topo"
      >
        ↑
      </button>
    </div>
  );
}

export default App;