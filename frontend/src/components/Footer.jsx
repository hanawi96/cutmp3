import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Music, 
  Heart, 
  Github, 
  Twitter, 
  Mail, 
  Globe, 
  Shield, 
  FileText,
  Scissors,
  RefreshCw,
  Mic,
  Volume2,
  Merge,
  Minimize2,
  ChevronUp
} from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const tools = [
    { name: 'MP3 Cutter', path: '/mp3-cutter', icon: Scissors },
    { name: 'Audio Converter', path: '/audio-converter', icon: RefreshCw },
    { name: 'Voice Recorder', path: '/voice-recorder', icon: Mic },
    { name: 'Audio Enhancer', path: '/audio-enhancer', icon: Volume2 },
    { name: 'Audio Merger', path: '/audio-merger', icon: Merge },
    { name: 'Audio Compressor', path: '/audio-compressor', icon: Minimize2 },
  ];

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand Section - Enhanced mobile layout */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-2">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-xl font-bold">Audio Tools</h3>
                <p className="text-gray-400 text-sm">Professional Audio Suite</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
              Complete suite of professional audio tools for cutting, converting, 
              recording, and processing audio files. Fast, secure, and completely free.
            </p>
            
            {/* Social Links - Enhanced mobile touch targets */}
            <div className="flex space-x-3 sm:space-x-4">
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-blue-600 p-3 rounded-lg transition-colors touch-manipulation"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-blue-500 p-3 rounded-lg transition-colors touch-manipulation"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-red-600 p-3 rounded-lg transition-colors touch-manipulation"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-green-600 p-3 rounded-lg transition-colors touch-manipulation"
                aria-label="Website"
              >
                <Globe className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Tools Section - Better mobile spacing */}
          <div className="col-span-1">
            <h4 className="text-lg font-semibold mb-4">Audio Tools</h4>
            <ul className="space-y-3">
              {tools.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <li key={tool.path}>
                    <Link 
                      to={tool.path} 
                      className="text-gray-300 hover:text-white transition-colors text-sm flex items-center py-1 touch-manipulation"
                    >
                      <IconComponent className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span>{tool.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Support Section - Enhanced mobile layout */}
          <div className="col-span-1">
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center py-1 touch-manipulation">
                  <FileText className="w-4 h-4 mr-3 flex-shrink-0" />
                  <span>Documentation</span>
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center py-1 touch-manipulation">
                  <Mail className="w-4 h-4 mr-3 flex-shrink-0" />
                  <span>Contact Us</span>
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center py-1 touch-manipulation">
                  <Shield className="w-4 h-4 mr-3 flex-shrink-0" />
                  <span>Privacy Policy</span>
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center py-1 touch-manipulation">
                  <FileText className="w-4 h-4 mr-3 flex-shrink-0" />
                  <span>Terms of Service</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer - Enhanced mobile layout */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
            <div className="flex items-center text-gray-400 text-sm text-center sm:text-left">
              <span>© {currentYear} Audio Tools Suite. Made with</span>
              <Heart className="h-4 w-4 mx-1 text-red-500" />
              <span>for audio enthusiasts</span>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
              <span className="text-gray-400 text-sm">All rights reserved</span>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top Button - Enhanced mobile design */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 sm:p-3 rounded-full shadow-lg transition-all duration-200 z-40 touch-manipulation hover:scale-105"
        aria-label="Back to top"
      >
        <ChevronUp className="w-5 h-5 sm:w-5 sm:h-5" />
      </button>
    </footer>
  );
} 