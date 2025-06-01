import React, { useState } from 'react';
import { Music, Menu, X, Scissors, Download, Share2, Settings } from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-2">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900">MP3 Cutter</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Professional Audio Editor</p>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
              <Scissors className="w-4 h-4 mr-2" />
              Features
            </a>
            <a href="#how-to-use" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              How to Use
            </a>
            <a href="#download" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Download
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="bg-gray-100 p-2 rounded-md text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 rounded-lg mt-2 border border-gray-200">
              <a
                href="#features"
                className="text-gray-700 hover:bg-blue-50 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center"
                onClick={toggleMenu}
              >
                <Scissors className="w-4 h-4 mr-3" />
                Features
              </a>
              <a
                href="#how-to-use"
                className="text-gray-700 hover:bg-blue-50 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center"
                onClick={toggleMenu}
              >
                <Settings className="w-4 h-4 mr-3" />
                How to Use
              </a>
              <a
                href="#download"
                className="text-gray-700 hover:bg-blue-50 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center"
                onClick={toggleMenu}
              >
                <Download className="w-4 h-4 mr-3" />
                Download
              </a>
              <div className="pt-2 border-t border-gray-200">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 