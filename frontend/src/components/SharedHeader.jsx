import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu,
  Headphones
} from 'lucide-react';

export default function SharedHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center mr-3 shadow-sm group-hover:shadow-md transition-all duration-200">
              <Headphones className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-medium text-gray-900">AudioTools</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/tools" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Tools</Link>
            <Link to="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Pricing</Link>
            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Sign in</Link>
            <Link to="/trial" className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-800 transform hover:scale-105 transition-all duration-200 shadow-sm hover:shadow-md">
              Try free
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-3 pt-3 pb-4 space-y-2 bg-gray-50 rounded-lg mt-2 mb-3 border border-gray-200 shadow-sm">
              <Link
                to="/tools"
                className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Tools
              </Link>
              <Link
                to="/pricing"
                className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                to="/login"
                className="block px-4 py-3 rounded-md text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/trial"
                className="block px-4 py-3 rounded-md text-base font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Try free
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 