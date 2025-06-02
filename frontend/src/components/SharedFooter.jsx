import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Headphones,
  Heart,
  Github,
  Twitter,
  Mail,
  Linkedin,
  Shield,
  FileText,
  ChevronUp,
  Lock,
  Award
} from 'lucide-react';

export default function SharedFooter() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
      {/* Main Footer Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
                <Headphones className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-medium text-white">AudioTools</span>
            </div>
            <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
              Professional audio tools for creators. Convert, edit, and process audio files with ease. 
              Completely free and secure.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Tools Section */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Tools</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/mp3-cutter" className="text-gray-300 hover:text-white transition-colors text-sm">
                  MP3 Cutter
                </Link>
              </li>
              <li>
                <Link to="/audio-converter" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Audio Converter
                </Link>
              </li>
              <li>
                <Link to="/voice-recorder" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Voice Recorder
                </Link>
              </li>
              <li>
                <Link to="/audio-merger" className="text-gray-300 hover:text-white transition-colors text-sm">
                  Audio Merger
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Support</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <FileText className="w-3 h-3 mr-2" />
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <Shield className="w-3 h-3 mr-2" />
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <FileText className="w-3 h-3 mr-2" />
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm flex items-center">
                  <Mail className="w-3 h-3 mr-2" />
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            <div className="flex items-center text-gray-300 text-xs">
              <Lock className="w-3 h-3 mr-1" />
              SSL Secured
            </div>
            <div className="flex items-center text-gray-300 text-xs">
              <Shield className="w-3 h-3 mr-1" />
              GDPR Compliant
            </div>
            <div className="flex items-center text-gray-300 text-xs">
              <Award className="w-3 h-3 mr-1" />
              SOC 2 Certified
            </div>
            <div className="flex items-center text-gray-300 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              All systems operational
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <div className="flex items-center text-gray-400 text-sm">
              <span>© {currentYear} AudioTools. Made with</span>
              <Heart className="h-3 w-3 mx-1 text-red-500" />
              <span>for creators</span>
            </div>
            <div className="text-gray-400 text-sm">
              All rights reserved
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 z-40 hover:scale-105"
        aria-label="Back to top"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
    </footer>
  );
} 