import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // يجب أن يحتوي هذا على إعدادات Tailwind أو CSS
import App from './App'; // استيراد المكون الرئيسي

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);