import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Music, 
  Menu, 
  X, 
  Scissors, 
  Home, 
  RefreshCw,
  Mic,
  Volume2,
  Merge,
  Minimize2
} from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const isActive = (path) => location.pathname === path;

  const tools = [
    { name: 'MP3 Cutter', path: '/mp3-cutter', icon: Scissors },
    { name: 'Audio Converter', path: '/audio-converter', icon: RefreshCw },
    { name: 'Voice Recorder', path: '/voice-recorder', icon: Mic },
    { name: 'Audio Enhancer', path: '/audio-enhancer', icon: Volume2 },
    { name: 'Audio Merger', path: '/audio-merger', icon: Merge },
    { name: 'Audio Compressor', path: '/audio-compressor', icon: Minimize2 },
  ];

  return (
    <header className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-2">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900">Audio Tools</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Professional Audio Suite</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex space-x-6">
            <Link 
              to="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                isActive('/') 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Link>
            
            {/* Tools Dropdown */}
            <div className="relative group">
              <button className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                Tools
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="py-2">
                  {tools.map((tool) => {
                    const IconComponent = tool.icon;
                    return (
                      <Link
                        key={tool.path}
                        to={tool.path}
                        className={`flex items-center px-4 py-2 text-sm transition-colors ${
                          isActive(tool.path)
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                      >
                        <IconComponent className="w-4 h-4 mr-3" />
                        {tool.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="lg:hidden">
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
          <div className="lg:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 rounded-lg mt-2 border border-gray-200">
              <Link
                to="/"
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center ${
                  isActive('/') 
                    ? 'text-blue-600 bg-blue-100' 
                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
                onClick={toggleMenu}
              >
                <Home className="w-4 h-4 mr-3" />
                Home
              </Link>
              
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                  Audio Tools
                </div>
                {tools.map((tool) => {
                  const IconComponent = tool.icon;
                  return (
                    <Link
                      key={tool.path}
                      to={tool.path}
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center ${
                        isActive(tool.path)
                          ? 'text-blue-600 bg-blue-100'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      onClick={toggleMenu}
                    >
                      <IconComponent className="w-4 h-4 mr-3" />
                      {tool.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 