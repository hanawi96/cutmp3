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
  Minimize2
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-2">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h3 className="text-xl font-bold">Audio Tools</h3>
                <p className="text-gray-400 text-sm">Professional Audio Suite</p>
              </div>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              Complete suite of professional audio tools for cutting, converting, 
              recording, and processing audio files. Fast, secure, and completely free.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              <a href="#" className="bg-gray-800 hover:bg-blue-600 p-2 rounded-lg transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 hover:bg-blue-500 p-2 rounded-lg transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 hover:bg-red-600 p-2 rounded-lg transition-colors">
                <Mail className="h-5 w-5" />
              </a>
              <a href="#" className="bg-gray-800 hover:bg-green-600 p-2 rounded-lg transition-colors">
                <Globe className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Tools Section */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Audio Tools</h4>
            <ul className="space-y-2">
              {tools.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <li key={tool.path}>
                    <Link 
                      to={tool.path} 
                      className="text-gray-300 hover:text-white transition-colors text-sm flex items-center"
                    >
                      <IconComponent className="w-4 h-4 mr-2" />
                      {tool.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center text-gray-400 text-sm">
              <span>© {currentYear} Audio Tools Suite. Made with</span>
              <Heart className="h-4 w-4 mx-1 text-red-500" />
              <span>for audio enthusiasts</span>
            </div>
            
            <div className="flex items-center space-x-6 mt-4 sm:mt-0">
              <span className="text-gray-400 text-sm">All rights reserved</span>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors z-40"
        aria-label="Back to top"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </footer>
  );
} 